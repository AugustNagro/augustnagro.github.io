---
layout: post
title: Vendetta against Java Streams
date: 2020-1-11
---

I like Java Streams as much as the next guy, but I can't say that my experience using them has been all sunny. Here's the long list of problems I've had with Streams during the last few years I've used them:

* Streams make single-threaded code harder to read and write. You need to categorize all your operations into the predefined 'map', 'reduce', etc. I often spend more time trying to shape my problem into Stream format than actually solving the problem.

* Debugging is painful. Unless you're using an advanced editor like Intellij IDEA, good luck.

* `Stream::parallel` implications are unclear. For example, what is the speedup of Files.list(...).parallel().collect(...)? You will gain maximum sqrt(#cores) speedup, since Files.list(..) returns an unsized stream, so AbstractTask has to progressively buffer. Nowhere will the docs tell you this!

* Parallel Streams all run on the the common (shared) ForkJoinPool. Sharing with others is fine, and even preferred, but if one of the submitted tasks blocks or behaves inappropriately, performance suffers for all tasks. Eventually Project Loom will be running your virtual threads on the ForkJoinPool (by default), which is another reason to be careful.

* The implementation of Parallel Streams is one-size-fits all; [directly using CountedCompleter can be much better](http://august.nagro.us/CountedCompleter.html).

* One of the interesting things about ForkJoinTasks is that they are serializable. Can't do that with parallel Streams.

* Stream Characteristics are half-heartedly implemented, and have strange effects on performance. If you have a SIZED Stream S, for example, S.limit(100) will lose its SIZED characteristic, hurting performance. A good blog on the matter: [https://richardstartin.github.io/posts/spliterator-characteristics-and-performance](https://richardstartin.github.io/posts/spliterator-characteristics-and-performance).

* If the size of Stream S is known, S.collect(Collectors.toList()) should be able to create its internal ArrayList capacity to the size of S, right? Nope, the ArrayList will have default size, and copy all its elements to a new array whenever the threshold is reached. The author created a [patch](https://github.com/AugustNagro/presize-collectors-bench) trying to fix this, but it was not accepted, probably for good reason... the Collector/Stream implementation just isn't designed to be sophisticated.

* We need to always think about auto-boxing, and use IntStream, LongStream, and mapToInt, mapToLong, etc.

* The implementation of Stream is complex and generates garbage. Using Streams over small datasets or in tight loops will kill performance.

* Catched exceptions are a huge pain to deal with. Code like `long sumOfSizes = Files.list(..).map(Files::size).sum();` is impossible, since we need to wrap Files.size in a try {...} catch (..) {} block.

* Streams cannot be used in for-each loops since Stream and Spliterator do not implement Iterable. For example:
{% highlight java %}
Stream<Path> paths = Files.list(...)
                          .filter(Files::isRegularFile);
for (Path p : paths) {
  ...
}
{% endhighlight %}

There was a proposal by Stewart Marks of Oracle to fix this, but Stream's push model is in fundamental contrast with Iterable's pull model. Not surprisingly, the proposal hasn't been implemented.

* Parallel streams are terrible if there's blocking (like waiting for IO or a monitor). With a custom CountedCompleter, you can use ManagedBlocker and Phasers to actually handle the problem, instead of just degrading the common ForkJoinPool, as parallel Streams do.

* I know grad students much smarter then me who work with Java daily, yet have never bothered to understand or make use of Streams. And I can't think of a good reason for them to do so. Few developers I work with even know about Streams, and those that do have a hard time explaining what a `terminal operation` is, or why `peek()` should be avoided outside debugging because it isn't pure.

---

Now lets consider the benefits Stream provides:

* You can use them at API points, to avoid defensive copying. Of course, this provides only a shallow defense, since the collection members themselves could still be mutated. One could avoid the defensive copying problem entirely by writing good JavaDoc, and having faith in your fellow developers.

* Quick and dirty parallelism is easy to implement. Definitely, but directly using CountedCompleter can be much faster. Parallelism is only an optimization, after all. (see [http://august.nagro.us/CountedCompleter.html](http://august.nagro.us/CountedCompleter.html)).

---

Maybe there are some points you disagree with, and maybe some workarounds, but think of the big picture here. Streams are just like the crufty GO4 design patterns you learn in college. By overloading the abstraction, we arrive at a solution that constrains the code we write, while muddying debugging and performance. So why does java.util.Stream even exist? Maybe it's a fig leaf for the starry-eyed purely-functional undergrads (addicts?), who would rather struggle implementing Quick Sort than build software that makes money. Which was me at one point, I ashamedly admit. In any case I think the OpenJDK developers did a good job building Stream. It is much better than Scala's approach in its standard library, but I will be avoiding both nonetheless.
