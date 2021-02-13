---
layout: post
title: Fast JSON in Scala 3 with Typeclass Derivation
date: 2021-2-15
---

What is the fastest way to parse & serialize JSON in Scala? Could it be [Circe](https://github.com/circe/circe), [BooPickle](https://github.com/suzaku-io/boopickle), [Play Json](https://github.com/playframework/play-json), or maybe [uPickle](https://github.com/lihaoyi/upickle)?

What if I told you the fastest Scala JSON library is already on your computer, implemented with native code, and updated regularly with improvements? Yes, I'm talking about the [JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) object in Node.js and your browser. Sorry if you feel tricked! But Scala is a multi-platform language; JavaScript is just as much a Scala runtime as the JVM. `JSON` is [among the best performing parsers of ANY language](https://github.com/kostya/benchmarks), including vectorized C++ libraries. The best 'Scala' (and Java) [library](https://github.com/ngs-doo/dsl-json) benchmarked is 'built for invasive software composition', and comes with its own 'DSL platform compiler'. `JSON` is simply the best.

Ok, so let's create a [Scala.js](https://www.scala-js.org/) project, write a case class, and serialize it to JSON!

{% highlight scala %}
import scala.scalajs.js.JSON

case class User(name: String, isAdmin: Boolean, age: Int)

// Compile Error!
JSON.stringify(User("John Smith", true, 42))
{% endhighlight %}

Unfortunately for us, [JSON.stringify](https://www.scala-js.org/api/scalajs-library/latest/scala/scalajs/js/JSON$.html) takes only native JavaScript parameters, ie, objects inheriting `scala.scalajs.js.Any`. As specified in the [interoperability guide](http://www.scala-js.org/doc/interoperability/sjs-defined-js-classes.html), we can make a native class by extending js.Object:

{% highlight scala %}
import scala.scalajs.js

// Compile Error!
case class User(name: String, isAdmin: Boolean, age: Int) extends js.Object
{% endhighlight %}

Not again! As the compiler tells us, it is forbidden for case classes to extend js.Object. Why is that? It has to do with the semantic difference between Scala.js objects and native JavaScript objects. When you create an object like `User("John Smith", true, 42)` for example, it does not automatically become 

{% highlight javascript %}
{
  name: "John Smith",
  isAdmin: true,
  age: 42
}
{% endhighlight %}

Instead, after `sbt fullLinkJS` (which runs the [Google Closure JavaScript Optimizer](https://github.com/google/closure-compiler)), the object properties may very well be 'a', 'b', and 'c'. Or, the object could be inlined & removed entirely. This feature is why Scala.js's [performance is almost always better than hand-written JavaScript](https://www.scala-js.org/doc/internals/performance.html).

It also means that to interop with native JavaScript libraries like `JSON`, you must give up Scala features like destructuring and pattern matching. Or, create native versions for every class and manually convert:

{% highlight scala %}
import scala.scalajs.js

case class User(name: String, isAdmin: Boolean, age: Int)
class NativeUser(val name: String, val isAdmin: Boolean, val age: Int) extends js.Object

// to JSON
val u = User("John Smith", true, 42)
val nativeUser = NativeUser(u.name, u.isAdmin, u.age)
val json: String = JSON.stringify(nativeUser)

// from JSON
val parsedNativeUser = JSON.parse(json).asInstanceOf[NativeUser]
val parsedUser = User(
  parsedNativeUser.name,
  parsedNativeUser.isAdmin,
  parsedNativeUser.age
)
{% endhighlight %}

I like to be DRY, and [Scala 3](https://dotty.epfl.ch/docs/reference/overview.html) gives us the power to achieve this with Typeclass derivation. Take a look:

{% highlight scala %}
import com.augustnagro.nativeconverter.NativeConverter

case class User(name: String, isAdmin: Boolean, age: Int) derives NativeConverter

// to JSON
val u = User("John Smith", true, 42)
val json = JSON.stringify(u.toNative)

// from JSON
val parsedUser = NativeConverter[User].fromNative(JSON.parse(json))
{% endhighlight %}

That's it, no manual conversion necessary.

A Typeclass lets you add behavior without inheritance. Instead of extending a class or implementing an interface, you create a Typeclass instance that operates on that type, and pass it around. Typeclasses let you add features to types you don't control, aka [Retroactive Polymorphism](https://august.nagro.us/retroactive-polymorphism-scala.html).

In Java, defining, instantiating, and passing around Typeclass instances would be inconvenient, so people `extend` instead. But Scala 3 makes it easy. When you write `case class User(..) derives NativeConverter`, the scala compiler calls method `NativeConverter::derived`, which generates a `given` instance in User's companion object. When you summon a NativeConverter for User, either with `summon[NativeConverter[User]]` or just `NativeConverter[User]` via the 0-arg `apply` helper method in `NativeConverter`, the same instance is returned.

The implementation of NativeConverter is about 400 lines of 0-dependency Scala, and is NOT A MACRO!
Here's the contract of the NativeConverter Typeclass:

{% highlight scala %}
trait NativeConverter[T]:
  extension (t: T) def toNative: js.Any
  def fromNative(nativeJs: js.Any): T
{% endhighlight %}

You can summon built-in NativeConverters for all the primitive types:

{% highlight scala %}
val i: Int = NativeConverter[Int].fromNative(JSON.parse("100"))

val nativeByte: js.Any = NativeConverter[Byte].toNative(127.toByte)

val s: String = NativeConverter[String]
  .fromNative(JSON.parse(""" "hello world" """))
{% endhighlight %}

Char and Long are always converted to String, since they cannot be represented directly in JavaScript:

{% highlight scala %}
// native String
val nativeLong = NativeConverter[Long].toNative(Long.MaxValue)

val parsedLong = NativeConverter[Long]
  .fromNative(JSON.parse(s""" "${Long.MaxValue}" """))
{% endhighlight %}

If you want to change this behavior for Long, implement a `given` instance of NativeConverter[Long]. The example below uses String for conversion only when the Long is bigger than Int.

{% highlight scala %}
given NativeConverter[Long] with

  extension (t: Long) def toNative: js.Any =
    if t > Int.MaxValue || t < Int.MinValue then t.toString
    else t.toInt.asInstanceOf[js.Any]

  def fromNative(nativeJs: js.Any): Long =
    try nativeJs.asInstanceOf[Int]
    catch case _ => nativeJs.asInstanceOf[String].toLong

// "123"
val smallLong: String = JSON.stringify(NativeConverter[Long].toNative(123L))

// """ "9223372036854775807" """.trim
val bigLong: String = JSON.stringify(NativeConverter[Long].toNative(Long.MaxValue)) 
{% endhighlight %}

Functions can be converted between Scala.js and Native:

{% highlight scala %}
val helloWorld = (name: String) => "hello, " + name

val nativeFunc = NativeConverter[String => String].toNative(helloWorld)

// returns "hello, Ray"
nativeFunc.asInstanceOf[js.Dynamic]("Ray") 
{% endhighlight %}

Arrays, Iterables, Seqs, Sets, Lists, and Buffers are serialized using JavaScript Arrays:

{% highlight scala %}
// default NativeConverters are only implemented
// for the collections in scala.collection.*, not the deprecated
// aliases in scala.Predef
import scala.collection.{Seq, Set}

val seq = Seq(1, 2, 3)
val set = Set(1, 2, 3)

// "[1,2,3]"
val seqJson = JSON.stringify(NativeConverter[Seq[Int]].toNative(seq))

// "[1,2,3]"
val setJson = JSON.stringify(NativeConverter[Set[Int]].toNative(set))
{% endhighlight %}

Maps become JavaScript objects:

{% highlight scala %}
import scala.collection.Map
import scala.collection.mutable.HashMap

val map = HashMap("a" -> 1, "b" -> 2)

// """ {"a":1,"b":2} """.trim
val mapJson = JSON.stringify(NativeConverter[Map[String, Int]].toNative(map))
{% endhighlight %}

Only String keys are supported, since JSON requires String keys. If you'd rather convert to an [ES 2016 Map](https://www.scala-js.org/api/scalajs-library/latest/scala/scalajs/js/Map.html), do the following:

{% highlight scala %}
import com.augustnagro.nativeconverter.EsConverters.given

val map = HashMap(1 -> 2, 3 -> 4)

val nativeMap = NativeConverter[Map[Int, Int]].toNative(map)

// returns 4
nativeMap.asInstanceOf[js.Dynamic].get(3)
{% endhighlight %}

I haven't implemented converters for all the native types, but if you ask me or make a pull request for one that's missing I will merge it.

Option is serialized using a 1-element array if Some, or [] if None:
{% highlight scala %}
val nc = NativeConverter[Option[Array[Int]]]
val some = Some(Array(1,2,3))

// "[[1,2,3]]"
val someJson = JSON.stringify(nc.toNative(some))

// None
val none = nc.fromNative(JSON.parse("[]"))
{% endhighlight %}

Any [Product](https://www.scala-lang.org/api/current/scala/Product.html) or Sum type (like case classes and enums) can derive a NativeConverter. If the Product is a Singleton (ie, having no parameters) then the type name or [productPrefix](https://www.scala-lang.org/api/current/scala/Product.html#productPrefix:String) is used. Otherwise, an object is created using the parameter names as keys.

You can for example redefine Option as a Scala 3 enum:

{% highlight scala %}
enum Opt[+T] derives NativeConverter:
  case Sm(x: T)
  case Nn

// """ "Nn" """.trim
val nnJson = JSON.stringify(Opt.Nn.toNative)

// Opt.Sm(123L)
val sm = NativeConverter[Opt[Long]].fromNative(JSON.parse(""" {"x":123} """))
{% endhighlight %}

And of course, you can nest to any depth you wish:

{% highlight scala %}
// recommended but not required for X to derive NativeConverter
case class X(a: List[String]) 
case class Y(b: Option[X]) derives NativeConverter

val y = Y(Some(X(List())))
val yStr = """ {"b":[{"a":[]}]} """.trim.nn

assertEquals(yStr, JSON.stringify(y.toNative))

assertEquals(y, NativeConverter[Y].fromNative(JSON.parse(yStr)))
{% endhighlight %}

If [Cross Building](https://www.scala-js.org/doc/project/cross-build.html) your Scala project you can use one language for both frontend and backend development. Sub-project `/jvm` will have your JVM sources, `/js` your JavaScript, and in `/shared` you can define all of your validations and request/response DTOs once. In the `/shared` project you do not want to depend on `NativeConverter`, since that would introduce a dependency on Scala.js in your `/jvm` project. So instead of writing `derives NativeConverter` on your case classes, create an object in `/client` that holds the derived converters:

{% highlight scala %}
// in shared project
case class User(name: String, isAdmin: Boolean, age: Int)

// in js project
object DtoConverters:
  given NativeConverter[User] = NativeConverter.derived

object App:
  import DtoConverters.given

  @main def launchApp: Unit =
    println(JSON.stringify(User("John", false, 21).toNative))
{% endhighlight %}

I've made a sample cross-project you can clone: [https://github.com/AugustNagro/native-converter-crossproject](https://github.com/AugustNagro/native-converter-crossproject)

But what about performance, surely making your own js.Object subclasses is faster?
Nope, derived NativeDecoders are 2x faster, even for simple cases like `User("John Smith", true, 42)`:

<p align="center">
<img src="http://august.nagro.us/images/bench/native-converter-vs-js-object-bench.png" class="img-responsive"><br>
</p>

See [these findings](https://august.nagro.us/scalajs-native-type-creation-bench.html) for more info.

The generated JavaScript code is very clean. I was amazed how nice it is when looking at `sbt fastLinkJS` output. This is all possible because of Scala 3's [`inline`](https://dotty.epfl.ch/docs/reference/metaprogramming/inline.html) keyword, and powerful type-level programming capabilities. That's right.. no Macros used whatsoever! The `derives` keyword on type T causes the NativeConverter Typeclass to be auto-generated in T's companion object. Only once, and when first requested.

It is safe to say that I am very impressed with Scala 3. And a big thank you to Sébastien Doeraene and Tobias Schlatter, who are first-rate maintainers of Scala.js, as well as Jamie Thompson who gave me advice on the conversion of Sum types.

The NativeConverter library is free on github here: [https://github.com/AugustNagro/native-converter](https://github.com/AugustNagro/native-converter)