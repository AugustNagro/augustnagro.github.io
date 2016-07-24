---
layout: post
title: List vs Vector in 2022
date: 2022-3-15
---

It's hard to choose between Scala's List and Vector.

On one hand, List is the most popular sequence. It is the default Seq, and most libraries including the Scala 3 compiler use it extensively. List is very fast in the usecases it is designed for, which are O(n) traversals, head/tail destructuring, and construction with prepend.

Vector is theoretically better than List. It adds O(1) length, O(1) access, O(1) update, and O(1) append methods. Vector is more complicated than List, which could affect its real-world performance. Of course, [List is not so simple either](https://alexn.org/blog/2021/02/12/scala-list-secret.html).

**Hypothesis:** If Vector can match List's performance in the common usecases, then we should prefer Vector.

## Usecase 1: O(n) Traversals

Given

{% highlight scala %}
case class Cls(i: Int)

val list: List[Cls] = ???
val vector: Vector[Cls] = ???
{% endhighlight %}

Which is faster?

{% highlight scala %}
@Benchmark
def listSum: Long =
  list.filter(_.i > 0).map(_.i.toLong).sum

@Benchmark
def vectorSum: Long =
  vector.filter(_.i > 0).map(_.i.toLong).sum
{% endhighlight %}

<p align="center">
<img src="http://august.nagro.us/images/list-vector-bench/traversals.png" class="img-responsive"><br>
</p>

If you have one million elements, Vector can do this 4 milliseconds faster. Not a very significant difference. So, Vector meets our requirement for O(n) traversals.

## Usecase 2: Construction with Prepend + Traversals

Of course, every collection needs to be constructed before being used. So lets look at construction followed by traversal.

If we construct using prepend, List wins.

{% highlight scala %}
@Benchmark
def listPrependAndSum: Long =
  var lst = List.empty[Cls]
  for cls <- data do lst = cls :: lst
  lst.filter(_.i > 0).map(_.i.toLong).sum

@Benchmark
def vectorPrependAndSum: Long =
  var vec = Vector.empty[Cls]
  for cls <- data do vec = cls +: vec
  vec.filter(_.i > 0).map(_.i.toLong).sum
{% endhighlight %}

<p align="center">
<img src="http://august.nagro.us/images/list-vector-bench/prepended-construction-plus-traversals.png" class="img-responsive"><br>
</p>

List is 28 ms faster in the case of 1 million elements. Which is starting to get significant; don't use Vector as a 'functional Stack'.

## Usecase 3: Construction with Append + Traversals

In-order construction with append is more common in everyday code. Lists are O(n) in this case so the only way to fairly compare is with their mutable builders:

{% highlight scala %}
@Benchmark
def listBuilderAndSum: Long =
  val builder = List.newBuilder[Cls]
  for cls <- data do builder.addOne(cls)
  val list = builder.result()

  list.filter(_.i > 0).map(_.i.toLong).sum


@Benchmark
def vectorBuilderAndSum: Long =
  val builder = Vector.newBuilder[Cls]
  for i <- data do builder.addOne(i)
  val vec = builder.result()

  vec.filter(_.i > 0).map(_.i.toLong).sum
{% endhighlight %}

<p align="center">
<img src="http://august.nagro.us/images/list-vector-bench/builder-construction-plus-traversals.png" class="img-responsive"><br>
</p>


Besides being faster than List's builder, the Vector builder is about 20% faster than building a List with prepend. It's also much faster than using `:+` on Vector:

<p align="center">
<img src="http://august.nagro.us/images/list-vector-bench/vector-builder-vs-append-plus-traversals.png" class="img-responsive"><br>
</p>

So use the builder when constructing a Vector item by item.

## Do Views help?

Each filter and map create a new collection. Will using a view help?
{% highlight scala %}
@Benchmark
def listViewSum: Long =
  list.view.filter(_.i > 0).map(_.i.toLong).sum

@Benchmark
def vectorViewSum: Long =
  vector.view.filter(_.i > 0).map(_.i.toLong).sum
{% endhighlight %}

Not significantly.

<p align="center">
<img src="http://august.nagro.us/images/list-vector-bench/view-traversals.png" class="img-responsive"><br>
</p>

Views are lazy, which makes debugging & resource safety harder. The performance difference on million-element collections is only a few milliseconds. So don't use them unless you measure.

## Conclusions

If you are using List like a functional Stack, keep using it.

Otherwise, Vector is just as fast and more flexible.

## JMH Benchmark

Results are using JDK 18 preview, Scala 3.1.1, Linux.

{% highlight scala %}

import org.openjdk.jmh.annotations.{Benchmark, BenchmarkMode, Fork, Measurement, Mode, Param, Scope, State, Warmup}

import java.util.ArrayDeque
import scala.util.Random
import org.openjdk.jmh.annotations.Setup
import scala.jdk.StreamConverters.*

case class Cls(i: Int)

@BenchmarkMode(Array(Mode.Throughput))
@State(Scope.Benchmark)
@Measurement(time = 1, iterations = 5)
@Warmup(time = 1, iterations = 5)
@Fork(value = 2)
class Bench:

  @Param(Array("100", "10000", "100000", "1000000"))
  var size: Int = _

  var data: Array[Cls] = _
  var list: List[Cls] = _
  var vector: Vector[Cls] = _

  @Setup
  def setup(): Unit =
    data = Array.fill(size)(Cls(Random.nextInt))
    list = List.from(data)
    vector = Vector.from(data)

  @Benchmark
  def listBuilderAndSum: Long =
    val builder = List.newBuilder[Cls]
    for cls <- data do builder.addOne(cls)
    val list = builder.result()

    list.filter(_.i > 0).map(_.i.toLong).sum


  @Benchmark
  def vectorBuilderAndSum: Long =
    val builder = Vector.newBuilder[Cls]
    for i <- data do builder.addOne(i)
    val vec = builder.result

    vec.filter(_.i > 0).map(_.i.toLong).sum

  @Benchmark
  def vectorBuildDirectAndSum: Long =
    var vec = Vector.empty[Cls]
    for cls <- data do vec = vec :+ cls

    vec.filter(_.i > 0).map(_.i.toLong).sum


  @Benchmark
  def listPrependAndSum: Long =
    var lst = List.empty[Cls]
    for cls <- data do lst = cls :: lst
    lst.filter(_.i > 0).map(_.i.toLong).sum

  @Benchmark
  def vectorPrependAndSum: Long =
    var vec = Vector.empty[Cls]
    for cls <- data do vec = cls +: vec
    vec.filter(_.i > 0).map(_.i.toLong).sum
  
  @Benchmark
  def listSum: Long =
    list.filter(_.i > 0).map(_.i.toLong).sum

  @Benchmark
  def vectorSum: Long =
    vector.filter(_.i > 0).map(_.i.toLong).sum

  @Benchmark
  def listViewSum: Long =
    list.view.filter(_.i > 0).map(_.i.toLong).sum

  @Benchmark
  def vectorViewSum: Long =
    vector.view.filter(_.i > 0).map(_.i.toLong).sum

  @Benchmark
  def listJavaStreamSum: Long =
    list.asJavaSeqStream.filter(_.i > 0).mapToLong(_.i.toLong).sum

  @Benchmark
  def vectorJavaStreamSum: Long =
    vector.asJavaSeqStream.filter(_.i > 0).mapToLong(_.i.toLong).sum
{% endhighlight %}