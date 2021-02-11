---
layout: post
title: What's the Fastest Way to Create JavaScript Types in Scala.js?
date: 2020-2-10
---

In [Scala.js](https://www.scala-js.org/), we cannot just write
{% highlight scala %}
class C(val a: String, val b: Boolean, val c: Int)

import scala.scalajs.js.JSON
JSON.stringify(C("hello world", true, 69))

// (this post uses Scala 3 syntax)
{% endhighlight %}

It's because [JSON.stringify](https://www.scala-js.org/api/scalajs-library/latest/scala/scalajs/js/JSON$.html) takes a native JavaScript parameter of type `js.Any`. So, what's the fastest way to create a native JavaScript type in Scala.js?

**Option 1:** Subclass of [js.Object](https://www.scala-js.org/api/scalajs-library/latest/scala/scalajs/js/Object.html).

{% highlight scala %}
import scala.scalajs.js
class C(val a: String, val b: Boolean, val c: Int) extends js.Object

JSON.stringify(C("hello world", true, 69))
{% endhighlight %}

**Option 2:** [Dynamic.literal](https://www.scala-js.org/api/scalajs-library/latest/scala/scalajs/js/Dynamic$$literal$.html) with tupled arguments.
{% highlight scala %}
val literal: js.Dynamic = js.Dynamic.literal("a" -> "hello world", "b" -> true, "c" -> 69)

JSON.stringify(literal)
{% endhighlight %}

**Option 3:** `Dynamic.literal` with varargs.
{% highlight scala %}
val literal: js.Dynamic = js.Dynamic.literal(a = "hello world", b = true, c = 69)

JSON.stringify(literal)
{% endhighlight %}

**Option 4:** `Dynamic.literal` with [Dynamic::updateDynamic](https://www.scala-js.org/api/scalajs-library/latest/scala/scalajs/js/Dynamic.html#updateDynamic(name:String)(value:scala.scalajs.js.Any):Unit).
{% highlight scala %}
val literal = js.Dynamic.literal()
literal.updateDynamic("a")("hello world")
literal.updateDynamic("b")(true)
literal.updateDynamic("c")(69)

JSON.stringify(literal)
{% endhighlight %}

**Option 5:** `js.Object` with `Dynamic::updateDynamic`
{% highlight scala %}
val dynamicObj = js.Object().asInstanceOf[js.Dynamic]
dynamicObj.updateDynamic("a")("hello world")
dynamicObj.updateDynamic("b")(true)
dynamicObj.updateDynamic("c")(69)

JSON.stringify(dynamicObj)
{% endhighlight %}

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
Guess now before scrolling!
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

<p align="center">
<img src="https://august.nagro.us/images/bench/scalajs-object-creation-bench.png" class="img-responsive"><br>
</p>

This result makes sense to me after looking at the codegen. Subclasses have initialization, `updateDynamic` is intrinsically translated into bracket access like `literal['a'] = 'hello world'`, and `Dynamic.literal()` does not have a non-varargs overload unlike `js.Object()`.

Full Benchmark Source:
{% highlight scala %}
import scala.scalajs.js
import scala.scalajs.js.JSON
import scala.util.Random

class C(val a: String, val b: Boolean, val c: Int) extends js.Object

@main def bench(): Unit =
  for _ <- 1 to 20 do loop()
  
def loop(): Unit =
  val limit = 1000000
  val res = Array.ofDim[String](limit)
  var i = 0
  
  var start = js.Date.now()
  while i < limit do
    res(i) = JSON.stringify(C("hello world", true, 69))
    i += 1
  var end = js.Date.now()
  def randomJson: String = res(Random.nextInt(res.size))
  println(s"ms to make $randomJson classes: ${end - start}")
  
  i = 0
  start = js.Date.now()
  while i < limit do
    res(i) = JSON.stringify(js.Dynamic.literal("a" -> "hello world", "b" -> true, "c" -> 69))
    i += 1
  end = js.Date.now()
  println(s"ms to make $randomJson literals via tuples: ${end - start}")
  
  i = 0
  start = js.Date.now()
  while i < limit do
    res(i) = JSON.stringify(js.Dynamic.literal(a = "hello world", b = true, c = 69))
    i += 1
  end = js.Date.now()
  println(s"ms to make $randomJson literals: ${end - start}")
  
  i = 0
  start = js.Date.now()
  while i < limit do
    val literal = js.Dynamic.literal()
    literal.updateDynamic("a")("hello world")
    literal.updateDynamic("b")(true)
    literal.updateDynamic("c")(69)
    res(i) = JSON.stringify(literal)
    i += 1
  end = js.Date.now()
  println(s"ms to make $randomJson literals via updateDynamic: ${end - start}")
  
  i = 0
  start = js.Date.now()
  while i < limit do
    val dynamicObj = js.Object().asInstanceOf[js.Dynamic]
    dynamicObj.updateDynamic("a")("hello world")
    dynamicObj.updateDynamic("b")(true)
    dynamicObj.updateDynamic("c")(69)
    res(i) = JSON.stringify(dynamicObj)
    i += 1
  end = js.Date.now()
  println(s"ms to make $randomJson objects with js.Object() + updateDynamic: ${end - start}")
  println()

{% endhighlight %}

Why does any of this matter? Next blog we will see!
