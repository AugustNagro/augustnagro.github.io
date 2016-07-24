---
layout: post
title: "Scala 3 Macros: Create Types with Arbitrary Values & Methods"
date: 2023-06-17
---

Sometimes you want to make types whose values & methods are determined programmatically, at compile time.

An example usecase is a `Builder` for arbitrary case classes:

{% highlight scala %}
case class User(firstName: String, age: Int)

val userBuilder = Builder[User]
  .withFirstName("Athena")
  .withAge(22)

println(userBuilder.age) // 22
println(userBuilder.build) // User("Athena", 22)
{% endhighlight %}

Note that autocomplete is somewhat working in Metals:

<p align="center">
<img src="http://august.nagro.us/images/metals-auto-complete.png" class="img-responsive"><br>
</p>

And that the type of `userBuilder` is

{% highlight scala %}
Builder[User] {
  val firstName: java.lang.String
  def withFirstName(value: java.lang.String): this
  val age: scala.Int
  def withAge(value: scala.Int): this
}
{% endhighlight %}

## Tools of the Trade

One way to implement the `Builder` would be with [Macro Annotations](https://scala-lang.org/api/3.3.0/scala/annotation/MacroAnnotation.html#), which are an [experimental feature](https://docs.scala-lang.org/scala3/reference/experimental/index.html) introduced in Scala 3.3.

But this is not required. [Programatic Structural Types](https://docs.scala-lang.org/scala3/reference/changed-features/structural-types.html#) already let us refine types with new vals and defs. Then we just need a macro to decide the names of the vals & defs. The macro must also be [transparent](https://docs.scala-lang.org/scala3/reference/metaprogramming/macros.html#relationship-with-transparent-inline) in order to return the programmatic type.

## Implementing the Builder class

As with other Structural Types, our Builder class must implement [Selectable](https://scala-lang.org/api/3.3.0/scala/Selectable.html).

{% highlight scala %}
class Builder[T](
    mirror: Mirror.ProductOf[T],
    getters: IArray[String],
    setters: IArray[String]
) extends Selectable:
  private val values = Array.ofDim[Object](getters.length)

  def selectDynamic(name: String): Any =
    values(getters.indexOf(name))

  def applyDynamic(name: String)(args: Any*): this.type =
    values(setters.indexOf(name)) = args.head.asInstanceOf[Object]
    this

  def build: T = mirror.fromProduct(Tuple.fromArray(values))
{% endhighlight %}

When we call `Builder[User].age`, this is translated by the compiler into `Builder[User].selectDynamic("age")`. Likewise, `Builder[User].withAge(22)` becomes `Builder[User].applyDynamic("withAge")(22)`. Finally, `build` uses a [Mirror](https://docs.scala-lang.org/scala3/reference/contextual/derivation.html#mirror) to instantiate the class.

For `Builder[User]`, the `getters` array must be `IArray("firstName", "age")`, and `setters` must be `IArray("withFirstName", "withAge")`.

## The Builder macro

Our macro is defined as the `apply` method in Builder's companion object:

{% highlight scala %}
import scala.deriving.*
import scala.compiletime.*
import scala.quoted.*

object Builder:
  transparent inline def apply[T <: Product] = ${ builderImpl[T] }
{% endhighlight %}

`builderImpl` summons the product mirror:

{% highlight scala %}
private def builderImpl[T: Type](using Quotes): Expr[Any] =
  Expr.summon[Mirror.ProductOf[T]].get match
    case '{
          $m: Mirror.ProductOf[T] {
            type MirroredElemLabels = mels
            type MirroredElemTypes = mets
          }
        } =>
      refineBuilder[T, mets, mels, Builder[T]](m)
{% endhighlight %}

`refineBuilder` is the meat and potatoes. It recursively loops over T's element types & labels, constructing the getter and setter arrays. [Refinement](https://scala-lang.org/api/3.x/scala/quoted/Quotes$reflectModule.html#) is used to construct the structural refinement on Builder[T]. For the getter, this refinement is a simple val (`Refinement(TypeRepr.of[Res], getter, TypeRepr.of[met])`). But setters are harder, since they are Methods returning `this.type`.

{% highlight scala %}
private def refineBuilder[T: Type, Mets: Type, Mels: Type, Res: Type](
    m: Expr[Mirror.ProductOf[T]],
    getters: IArray[String] = IArray.empty,
    setters: IArray[String] = IArray.empty
)(using Quotes): Expr[Any] =
  import quotes.reflect.*
  (Type.of[Mets], Type.of[Mels]) match
    case ('[met *: metTail], '[mel *: melTail]) =>
      val getter: String = Type.valueOfConstant[mel].get.toString
      val setter = "with" + getter.head.toUpper + getter.substring(1)
      val getterRefinement =
        Refinement(TypeRepr.of[Res], getter, TypeRepr.of[met])
      val setterRefinement = RecursiveType: parent =>
        val mt =
          MethodType(List("value"))(
            _ => List(TypeRepr.of[met]),
            _ => parent.recThis
          )
        Refinement(getterRefinement, setter, mt)
      setterRefinement.asType match
        case '[tpe] =>
          refineBuilder[T, metTail, melTail, tpe](
            m,
            getters :+ getter,
            setters :+ setter
          )
    case ('[EmptyTuple], '[EmptyTuple]) =>
      '{
        new Builder[T](
          $m,
          ${ Expr(getters) },
          ${ Expr(setters) }
        ).asInstanceOf[Res]
      }
{% endhighlight %}

## Error Messages

Because the setter methods return `this.type`, compiling `Builder[User].wrongMethodName(22)` makes scalac stack overflow. Hopefully there's a better way to encode the refinement with RecursiveType.

## Conclusions

Scala 3 meta-programming is a pleasure to use. Macros + structural types allow many possibilities, but should only be used when all other methods are exhausted, since the IDE support and error messages are not as good as the alternatives.

Edit: It appears that returning `this` in a structural type is deprecated: https://github.com/lampepfl/dotty/discussions/14056#discussioncomment-6238099

## Final Code

{% highlight scala %}
import scala.deriving.*
import scala.compiletime.*
import scala.quoted.*
import scala.collection.mutable as m
import scala.reflect.{ClassTag, classTag}

class Builder[T](
    mirror: Mirror.ProductOf[T],
    getters: IArray[String],
    setters: IArray[String]
) extends Selectable:
  private val values = Array.ofDim[Object](getters.length)

  def selectDynamic(name: String): Any =
    values(getters.indexOf(name))

  def applyDynamic(name: String)(args: Any*): this.type =
    values(setters.indexOf(name)) = args.head.asInstanceOf[Object]
    this

  def build: T = mirror.fromProduct(Tuple.fromArray(values))

object Builder:
  transparent inline def apply[T <: Product] = ${ builderImpl[T] }

  private def builderImpl[T: Type](using Quotes): Expr[Any] =
    Expr.summon[Mirror.ProductOf[T]].get match
      case '{
            $m: Mirror.ProductOf[T] {
              type MirroredElemLabels = mels
              type MirroredElemTypes = mets
            }
          } =>
        refineBuilder[T, mets, mels, Builder[T]](m)

  private def refineBuilder[T: Type, Mets: Type, Mels: Type, Res: Type](
      m: Expr[Mirror.ProductOf[T]],
      getters: IArray[String] = IArray.empty,
      setters: IArray[String] = IArray.empty
  )(using Quotes): Expr[Any] =
    import quotes.reflect.*
    (Type.of[Mets], Type.of[Mels]) match
      case ('[met *: metTail], '[mel *: melTail]) =>
        val getter: String = Type.valueOfConstant[mel].get.toString
        val setter = "with" + getter.head.toUpper + getter.substring(1)
        val getterRefinement =
          Refinement(TypeRepr.of[Res], getter, TypeRepr.of[met])
        val setterRefinement = RecursiveType: parent =>
          val mt =
            MethodType(List("value"))(
              _ => List(TypeRepr.of[met]),
              _ => parent.recThis
            )
          Refinement(getterRefinement, setter, mt)
        setterRefinement.asType match
          case '[tpe] =>
            refineBuilder[T, metTail, melTail, tpe](
              m,
              getters :+ getter,
              setters :+ setter
            )
      case ('[EmptyTuple], '[EmptyTuple]) =>
        '{
          new Builder[T](
            $m,
            ${ Expr(getters) },
            ${ Expr(setters) }
          ).asInstanceOf[Res]
        }
{% endhighlight %}