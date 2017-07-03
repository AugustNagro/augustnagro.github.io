---
layout: post
title: "Retroactive Polymorphism with Scala Typeclasses"
date: 2017-1-31
---
As an object-functional language, Scala supports many ways of writing generic, polymorphic code. This article will introduce retroactive polymorphism, and examine the advanced language features enabling it in Scala.

Suppose we are writing a function `sum` that combines the elements of a sequence. The definition is simple with a numeric type like `scala.Int` or `java.lang.Integer`.

Scala
{% highlight scala %}
def sum(xs: Seq[Int]): Int = xs.reduce(_ + _)

val ints = Seq(1,2,3)
sum(ints) // 6
{% endhighlight %}
Java
{% highlight java %}
public Integer sum(List<Integer> xs){
    return xs.stream().reduce((x,y) -> x + y).get();
}

List<Integer> ints = new ArrayList<>();
ints.add(1);
ints.add(2);
ints.add(3);

sum(ints); // 6
{% endhighlight %}

When `sum` is generic, however, the elements' capability to combine must be explicitly stated. One approach is declaring an interface `Semigroup[A]`,

{% highlight scala %}
trait Semigroup[A]{
  def combine(y: A): A
}

def sum[A <: Semigroup[A]](xs: Seq[A]): A = 
  xs.reduce((x, y) => x.combine(y))

{% endhighlight %}

Or in Java:

{% highlight java %}
public interface Semigroup<A> {
    A combine(A y);
}
public <A extends Semigroup<A>> A sum(List<A> xs){
  return xs.stream().reduce(Semigroup::combine).get();
}
{% endhighlight %}

Types implementing `Semigroup` can now be passed to `sum`

{% highlight scala %}
case class Point(x: Int, y: Int) extends Semigroup[Point]{
  def combine(p: Point): Point = Point(x + p.x, y + p.y)
}

sum(Point(1,2) :: Point(2,5) :: Nil) // Point(3,7)
{% endhighlight %}

But it's impossible to retroactivly declare types we don't control (Like `scala.Int`) as `Semigroup`s. Scala offers two workarounds: the Adapter Pattern and Type Classes. 

Lets first consider Adapters. Popularized by the Gang of Four and used in Java, we define generic wrappers for every type needed:

{% highlight scala %}
trait SemigroupLike[A]{
  def get: A
  def combine(a: SemigroupLike[A]): SemigroupLike[A]
}

case class Point(x: Int, y: Int)

case class SemigroupLikePoint(p: Point) extends SemigroupLike[Point]{
  def get: Point = p
  
  def combine(a: SemigroupLike[Point]): SemigroupLike[Point] =
    SemigroupLikePoint(Point(p.x + a.get.x, p.y + a.get.y))
}

case class SemigroupLikeInt(i: Int) extends SemigroupLike[Int]{
  def get: Int = i
  
  def combine(a: SemigroupLike[Int]): SemigroupLike[Int] =
    SemigroupLikeInt(i + a.get)
}

def sum[A](xs: Seq[SemigroupLike[A]]): A =
  xs.reduce((a,b) => a.combine(b)).get
{% endhighlight %}

But this requires users to laboriously create wrapper objects, which is both wordy and unperformant:

{% highlight scala %}
val a = SemigroupLikePoint(Point(1,2))
val b = SemigroupLikePoint(Point(2,3))

sum(a :: b :: Nil) // Point(3,5)

val x = SemigroupLikeInt(1)
val y = SemigroupLikeInt(2)

sum(x :: y :: Nil) // 3
{% endhighlight %}

Typeclasses circumvent the Adapter Pattern's issues, at the potential cost of greater complexity. Instead of extending type `T` with an interface to declare some behavior `B`, a typeclass implementation is an external object able to perform `B` on `T`. Beginning with the simplest of typeclasses, this post and its follow-ups should progress to the advanced definitions seen in the wild.

As implementations of the typeclass `Semigroup[A]` will be themselves combining elements of type `A`, a second parameter `b` is added to `Semigroup.combine`:

{% highlight scala %}
trait Semigroup[A]{
  def combine(a: A, b: A): A
}

case class Point(x: Int, y: Int)
{% endhighlight %}

`sum` can now be redefined as:

{% highlight scala %}
def sum[A](xs: Seq[A], semi: Semigroup[A]): A =
  xs.reduce(semi.combine)
{% endhighlight %}

And used after implementing `Semigroup` for `Point` and `Int`

{% highlight scala %}
val pointSemigroup = new Semigroup[Point] {
  def combine(a: Point, b: Point): Point =
    Point(a.x + b.x, a.y + b.y)
}

// As trait `Semigroup` has a single abstract method (SAM),
// Defining implementations with lambda syntax is supported in
// Scala 2.12.X
val intSemigroup: Semigroup[Int] = (a,b) => a + b

val a = Point(1,2)
val b = Point(2,3)
sum(Seq(a,b), pointSemigroup) // Point(3,5)

val x = 1
val y = 2
val z = 3
sum(Seq(x,y), intSemigroup) // 6

intSemigroup.combine(x,y) // 3
{% endhighlight %}

There are still many issues with our typeclass, namely:
<ul>
<li><code class="highlighter-rouge">Semigroup</code> instances must be manually passed around</li>
<li>It would be preferable in many cases to use infix notation <code class="highlighter-rouge">1.combine(2)</code> vs <code class="highlighter-rouge">intSemigroup.combine(1,2)</code></li>
</ul>

Implicit parameters solve the former. If a second `implicit` parameter list is added to `sum`, the compiler will attempt to find an implicitly declared instance, first using static scoping rules, and finally by checking the typeclass's static fields. Redeclaring `sum` and `intSemigroup`,

{% highlight scala %}
def sum[A](xs: Seq[A])(implicit semi: Semigroup[A]): A =
  xs.reduce(semi.combine)
{% endhighlight %}

Or alternatively using [Context Bound](http://docs.scala-lang.org/tutorials/FAQ/context-bounds) syntax,

{% highlight scala %}
def sum[A: Semigroup](xs: Seq[A]): A =
  xs.reduce(implicitly[Semigroup[A]].combine)
{% endhighlight %}

`sum` can now be called without passing `intSemigroup`

{% highlight scala %}
implicit val intSemigroup: Semigroup[Int] =
  (a,b) => a + b

sum(1 :: 2 :: 3 :: Nil) // 6
{% endhighlight %}

Implicits also permit a form of ad-hoc polymorphism when used with typeclasses; should a library designer declare common instances in the typeclass's companion object, users are free to pass or implicitly declare alternate definitions.

{% highlight scala %}
implicit val reversedStringSemi: Semigroup[String] =
  (a,b) => b + a

trait Semigroup[A]{
  def combine(a: A, b: A): A
}
object Semigroup {
  
  implicit val stringSemigroup: Semigroup[String] =
    (a,b) => a + b
}

// reversedStringSemi found first by compiler
sum("nick" :: "loves" :: "honey" :: Nil) // "honeylovesnick"
{% endhighlight %}

To scrap some boilerplate, we define static `Semigroup.apply[A]` to return the implicitly required `Semigroup[A]`.

{% highlight scala %}
object Semigroup { 
  def apply[A](implicit ev: Semigroup[A]): Semigroup[A] = ev
  
  ???
}

// or, using context-bound syntax

object Semigroup {
  def apply[A: Semigroup]: Semigroup[A] = implicitly
  
  ???
}

def sum[T: Semigroup](xs: Seq[T]): T =
  xs.reduce(Semigroup[T].combine)
{% endhighlight %}

Although I find the context-bound `Semigroup.apply` more appealing, the first version should be used because it can be inlined if desired.

Next up is infix syntax. Scala has [implicit classes](http://docs.scala-lang.org/overviews/core/implicit-classes.html) which allow just that:

{% highlight scala %}
object Semigroup {

  ???

  implicit class SemigroupOps[A: Semigroup](lhs: A){

    def combine(rhs: A): A = Semigroup[A].combine(lhs,rhs)

    /** alias for `combine` */
    def |+| (rhs: A): A = Semigroup[A].combine(lhs, rhs)
  }
}

import Semigroup._

Semigroup[String].combine("foo", "bar") // "foobar"
"foo" |+| "bar" // "foobar"
{% endhighlight %}

Regular implicit classes create a lot of wrapper objects, so `SemigroupOps` should be restructured as a [Value Class](http://docs.scala-lang.org/overviews/core/value-classes.html), which doesn't allocate any runtime objects when used correctly.

{% highlight scala %}
implicit class SemigroupOps[A](val lhs: A) extends AnyVal{

  def combine(rhs: A)(implicit semi: Semigroup[A]): A =
    semi.combine(lhs, rhs)

  /** alias for `combine` */
  def |+| (rhs: A)(implicit semi: Semigroup[A]): A =
    semi.combine(lhs, rhs)
}
{% endhighlight %}

### Conclusions

Typeclasses are a powerful means of achieving retroactive polymorphism. In future posts, I hope to cover the different styles used by open source libraries like [spire](https://github.com/non/spire) and [cats](typelevel.org/cats/), with usability and performance considerations.

The final code can be found [here](https://gist.github.com/AugustNagro/13bf6ec2c8d984e25ccf7a09694f87e9)

### Notes
It should also be mentioned that while [Structural Types](http://docs.scala-lang.org/style/types.html#structural-types) can be used in similar ways, the feature relies on runtime reflection and is discouraged from use.
