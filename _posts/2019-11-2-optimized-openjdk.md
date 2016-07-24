---
layout: post
title: Build OpenJDK for a Nice Speedup
date: 2019-11-2
---
Just-in-time compilation (JIT) is a beautiful thing, and Java leads the industry. But unlike C2, which compiles your class files with optimizations for a particular OS (mac), ISA (x86_64), and Architecture (Intel Broadwell), JVM distributions themselves are compiled **only** for OS and ISA. This enables portability while reducing the number of build combinations for vendors.

The native code running alongide your Java app, like C1 and the garbage collector, is significant. The question is, if we compile OpenJDK for our own architecture, will app throughput improve in a significant way? The answer appears to be yes.

### Building the JDK
We'll be comparing [AdoptOpenJDK](https://adoptopenjdk.net/)'s Mac OpenJDK 13, and a custom-built OpenJDK 13. Both are the same build, 33. These are my build instructions:

* Clone the OpenJDK [git mirror](https://github.com/openjdk/jdk)
* Check out release [33](https://github.com/openjdk/jdk/releases/tag/jdk-13%2B33)
* Run `bash configure` according to [the doc](https://hg.openjdk.java.net/jdk/jdk/raw-file/f547a06da806/doc/building.html):

{% highlight bash %}
bash configure --with-jvm-variants=server --with-jvm-features=link-time-opt \
--with-extra-cflags='-Ofast -march=native -mtune=broadwell -funroll-loops -fomit-frame-pointer' \
--with-extra-cxxflags='-Ofast -march=native -mtune=broadwell -funroll-loops -fomit-frame-pointer'
{% endhighlight %}

We configure with the standard `server` varient, which includes jvm-features like `g1gc` and `c2`. Additionally, `link-time-opt` is added to the build. I could not find any documentation on this feature, but presumably it performs link time optimization, which should improve performance. Now lets consider the C and C++ compile flags.

`-Ofast` is the highest optimization profile available in clang and gcc, and comes with a few drawbacks. Binary size may be larger, and floating-point semantics are relaxed. One may replace this profile with `-O3`, which keeps strict fp conformance, or `-O2`, which also maintains binary size. I have tested with both Ofast and O3, and haven't experienced problems with either. But your mileage may vary.

`-march=native` and `-mtune=broadwell` tell the compiler to optimize for your architecture. One would think given the compiler documentation that `march` implies `mtune`, but this is [apparently not the case](https://lemire.me/blog/2018/07/25/it-is-more-complicated-than-i-thought-mtune-march-in-gcc/).

`-funroll-loops` ensures that loops are unrolled. Loop unrolling should be especially performant, since `march` is specified. Loop unrolling is included with clang's `-O3` and up, but must be manually set for gcc.

`-fomit-frame-pointer` allows the compiler to omit frame pointers when possible, freeing a register. This could make debugging the JVM's native code painful.
    
* Make the jdk with:

{% highlight bash %}
make images CONF=macosx-x86_64-server-release
{% endhighlight %}

The build takes only 15 minutes or so on my early 2015 macbook, even with optimizations enabled.

* Find the jdk in `build/macosx-x86_64-server-release/images/jdk-bundled`, append to PATH and run some tests!

### Benchmarks
[DaCapo](http://dacapobench.sourceforge.net/) was the first benchmark suite I ran.

<p align="center"><img src="/images/bench/dacapo.png" class="img-responsive" alt="DaCapo Results"></p>

The optimized JDKs outperform in every case, with the avrora and fop benchmarks getting **big** speedups with `-Ofast`. Really curious as to why this is the case!

Next up I ran some benchmarks from the [Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/benchmarksgame/).

<p align="center"><img src="/images/bench/benchmarks-game.png" class="img-responsive" alt="Benchmarks Game Results"></p>

These I calculated with `time for i in {1..10}; do java <class>; done`, and divided by 10. There was no significant difference between the JDKs. Unlike DaCapo, these benchmarks are not representative of normal workloads and should be given less value. For example, none of the benchmarks generate garbage or exercise JVM features other than C2. But at least we know that C2 and startup are not the benefactors of the optimizations!

Finally I executed some JMH microbenchmarks for [Netty](https://netty.io/wiki/microbenchmarks.html)'s HttpObjectEncoder:

<p align="center"><img src="/images/bench/netty.png" class="img-responsive" alt="Netty JMH Results"></p>

I chose this microbenchmark somewhat at random after looking at Netty's [extensive collection](https://github.com/netty/netty/tree/4.1/microbench/src/main/java/io/netty/microbench). The speedup is massive in the case when allocation is not pooled, and void Promises are not returned, and still big otherwise. Of course, these methods are unlikely to dominate your application's performance. There appears to be a glitch in the second chunked bench. 

Note: Netty offers [Native Transport](https://netty.io/wiki/native-transports.html)... so if we could compile *this* as well!

### Other Compilers and OS
I also tried building with [Intel's Compiler](https://software.intel.com/en-us/c-compilers), and patched the configure scripts to allow it. However, the build failed cryptically. I'd also be interested to see Linux results.

### Summary

So, while you need to test with your own applications, it is clear that targeting the JDK to a specific architecture can provide significant throughput improvements. Coupled with the absolute ease of building new JDKs ([Project Skara](https://openjdk.java.net/projects/skara/) is awesome), developers of performance-critical Java applications should seriously consider building an optimized JDK, just the same as C/++ developers build optimized binaries.

### Tables for Those Inclined

<p align="center"><img src="/images/bench/dacapo-table.png" class="img-responsive" alt="DaCapo Table"></p>
<p align="center"><img src="/images/bench/benchmarks-game-table.png" class="img-responsive" alt="Benchmarks Game Table"></p>
<p align="center"><img src="/images/bench/netty-table.png" class="img-responsive" alt="Netty Table"></p>

### Modesty
I doubt my methodology is perfect, if not let me know!

