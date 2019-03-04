---
layout: post
title: "*Really* Small Java Apps"
date: 2019-3-4
---
Since bundling apps and runtime is the new best-practice (whether with Docker or [jpackage](http://jdk.java.net/jpackage/)), and the full JVM weighs in at hundreds of megabytes, how can we include only the minimal JVM subset our application requires? This post explores 4 complementary ways:

1. [Build a minimal JDK image](#building-the-jdk)
2. [Use jlink to create an application image](#jlink)
3. [Choose a minimal docker image](#docker)
4. [Use the jlink image with jpackage](#jpackage)

### Building the JDK
OpenJDK has many features, including 7 Garbage Collectors (Epsilon, Serial, Parallel, CMS, G1, Shennandoah, ZGC!!) and experimental compilers like Graal. [Building the OpenJDK](https://hg.openjdk.java.net/jdk/jdk/raw-file/2bd3e05d4c6f/doc/building.html) is suprisingly easy (took 12 minutes for a fresh build on my 2015 macbook), so lets strip out what we don't need!

We care about two [`configure`](https://hg.openjdk.java.net/jdk/jdk/raw-file/2bd3e05d4c6f/doc/building.html#common-configure-arguments) options: `--with-jvm-variants=<variant>[,<variant>...]` and `--with-jvm-features=<feature>[,<feature>...]`. By default `configure` uses the `server` variant, which includes features:

* `aot`: experimental [ahead of time compilation](https://openjdk.java.net/jeps/295)
* `cds`: [class Data Sharing](http://openjdk.java.net/groups/hotspot/docs/HotSpotGlossary.html)
* `cmsgc`: [concurrent mark sweep gc](https://docs.oracle.com/en/java/javase/11/gctuning/concurrent-mark-sweep-cms-collector.html#GUID-FF8150AC-73D9-4780-91DD-148E63FA1BFF)
* `compiler1`: the [C1 compiler](http://openjdk.java.net/groups/hotspot/docs/HotSpotGlossary.html)
* `compiler2`: the [C2 compiler](http://openjdk.java.net/groups/hotspot/docs/HotSpotGlossary.html)
* `dtrace`: support for the [tracing framework](https://en.wikipedia.org/wiki/DTrace)
* `epsilongc`: a [no-op gc](https://openjdk.java.net/jeps/318)
* `g1gc`: the [garbage-first garbage collector](https://docs.oracle.com/en/java/javase/11/gctuning/garbage-first-garbage-collector.html#GUID-ED3AB6D3-FD9B-4447-9EDF-983ED2F7A573)
* `graal`: experimental [C2 replacement written in Java](https://openjdk.java.net/jeps/317)
* `jfr`: [Java Flight Recorder](https://docs.oracle.com/javacomponents/jmc-5-4/jfr-runtime-guide/about.htm#JFRUH170) support
* `jni-check`: [Java Native Interface](https://en.wikipedia.org/wiki/Java_Native_Interface) support
* `jvmci`: the [compiler interface](https://openjdk.java.net/jeps/243) needed for Graal and other plugin-in JITs
* `jvmti`: [tools interface](https://docs.oracle.com/javase/8/docs/technotes/guides/jvmti/) for debuggers and profilers
* `management`: app monitoring/management support with [Java Management Extensions](https://en.wikipedia.org/wiki/Java_Management_Extensions)
* `nmt`: [Native Memory Tracking](https://docs.oracle.com/javase/8/docs/technotes/guides/vm/nmt-8.html)
* `parallelgc`: the [Parallel GC](https://docs.oracle.com/en/java/javase/11/gctuning/parallel-collector1.html#GUID-DCDD6E46-0406-41D1-AB49-FB96A50EB9CE)
* `serialgc`: the [Serial GC](https://docs.oracle.com/en/java/javase/11/gctuning/available-collectors.html#GUID-45794DA6-AB96-4856-A96D-FDE5F7DEE498)
* `services`: not really sure.. maybe the ServiceProvider api?
* `shenandoahgc`: [Shenandoah GC](https://openjdk.java.net/jeps/189)
* `vm-structs`: [for servicability agents](https://openjdk.java.net/groups/hotspot/docs/Serviceability.html)

The other varients are server, client, minimal, core, zero, and custom. `minimal` comes with compiler1, dtrace, and serialgc.

My app doesn't need most of this, so I build a minimal JDK with C1, C2, DTrace, G1GC, and CDS (for quicker startup, requires G1GC):

{% highlight bash %}
bash configure --with-jvm-variants=minimal \
    --with-jvm-features=compiler2,g1gc,cds
{% endhighlight %}

Configure should spit out something like

{% highlight bash %}
====================================================
The existing configuration has been successfully updated in
/Users/august/Documents/prog/openjdk/jdk/build/macosx-x86_64-minimal-release
using configure arguments '--with-jvm-variants=minimal --with-jvm-features=compiler2,g1gc,cds'.

Configuration summary:
* Debug level:    release
* HS debug level: product
* JVM variants:   minimal
* JVM features:   minimal: 'cds compiler1 compiler2 dtrace g1gc minimal serialgc'
* OpenJDK target: OS: macosx, CPU architecture: x86, address length: 64
* Version string: 13-internal+0-adhoc.august.jdk (13-internal)

Tools summary:
* Boot JDK:       openjdk version "13-ea" 2019-09-17 OpenJDK Runtime Environment (build 13-ea+6) OpenJDK 64-Bit Server VM (build 13-ea+6, mixed mode, sharing)  (at /Library/Java/JavaVirtualMachines/jdk-13.jdk/Contents/Home)
* Toolchain:      clang (clang/LLVM from Xcode 10.1)
* C Compiler:     Version 10.0.0 (at /usr/bin/clang)
* C++ Compiler:   Version 10.0.0 (at /usr/bin/clang++)

Build performance summary:
* Cores to use:   4
* Memory limit:   8192 MB
{% endhighlight %}

Then make:
{% highlight bash %}
make images CONF=macosx-x86_64-minimal-release
{% endhighlight %}

You can now use `java`, `jlink`, etc from the [build output](https://hg.openjdk.java.net/jdk/jdk/raw-file/2bd3e05d4c6f/doc/building.html#build-output-structure).

### jlink
If your app uses the Java Module System, it's easy to make a minimal JRE image, with just the modules you require:

{% highlight bash %}
jlink --compress=1 --no-header-files            \
    --no-man-pages --strip-debug                \
    --output <path> --module-path <module path> \
    --add-modules <module>[,<module>...]
{% endhighlight %}

Make sure not to use compress=2, since your applicationn will be slower, AND larger (at least [for now](https://twitter.com/cl4es/status/1100399121079455744)).

### Docker
Google's [Distroless project](https://github.com/GoogleContainerTools/distroless) has minimal docker images. If using a jlink image then the [base](https://github.com/GoogleContainerTools/distroless/blob/master/base/README.md) image (8mb) should be prefered.

### Jpackage

There are early-access builds of jpackage [available](http://jdk.java.net/jpackage/). Jlinked images can be specified with an option.

### Conclusions
For a simple project requiring java.net.http, using these steps produced a 23MB jlink image. Hopefully this can be improved further if jlink improves --compress=2 to use LZ4 (https://twitter.com/shipilev/status/1100396679285665794)
