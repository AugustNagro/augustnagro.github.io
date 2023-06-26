---
layout: post
title: "Scala 3 Macros: How to Read Annotations"
date: 2023-06-25
---

This post will examine how to read class & field `StaticAnnotation`s from a Scala 3 Macro.

## Types of Annotations

Scala has a few different types of annotations. The base class of all annotations is [Annotation](https://scala-lang.org/api/3.3.0/scala/annotation/Annotation.html#), but developers should extend one of the subtypes. [StaticAnnotation](https://scala-lang.org/api/3.3.0/scala/annotation/StaticAnnotation.html)s are persisted to the class file, and can be read from macros. [ConstantAnnotation](https://scala-lang.org/api/3.3.0/scala/annotation/ConstantAnnotation.html) extends `StaticAnnotation` and requires all parameters to be compile-time constants. Finally, [MacroAnnotation](https://scala-lang.org/api/3.3.0/scala/annotation/MacroAnnotation.html) is an experimental annotation that can transform & create new definitions.

## Reading Annotations on a Class

Assume we have the following `SqlName` StaticAnnotation, applied to a class:

{% highlight scala %}
class SqlName(val sqlName: String) extends StaticAnnotation

@SqlName("app_user")
case class AppUser(
  id: Long,
  firstName: Option[String],
  lastName: String
)
{% endhighlight %}

We can read the `sqlName` value with the following macro:

{% highlight scala %}
import scala.compiletime.*
import scala.quoted.*

inline def sqlNameFor[T]: Option[String] = ${ sqlNameForImpl[T] } 

private def sqlNameForImpl[T: Type](using Quotes): Expr[Option[String]] =
  import quotes.reflect.*
  val annot = TypeRepr.of[SqlName]
  TypeRepr
    .of[T]
    .typeSymbol
    .annotations
    .collectFirst:
      case term if term.tpe =:= annot => term.asExprOf[SqlName]
  match
    case Some(expr) => '{ Some($expr.sqlName) }
    case None       => '{ None }
{% endhighlight %}

In a different file:

{% highlight scala %}
@main def main: Unit =
  println(sqlNameFor[AppUser]) // Some(app_user)
{% endhighlight %}

## Reading Annotations on a Field

Let's take the same `SqlName` annotation as above, and apply it on a field:

{% highlight scala %}
class SqlName(val sqlName: String) extends StaticAnnotation

case class AppUser(
  id: Long,
  firstName: Option[String],
  @SqlName("last_name") lastName: String
)
{% endhighlight %}

We can read the `sqlName` value with the following macro:

{% highlight scala %}
inline def sqlFieldNamesFor[T]: Vector[(String, String)] = ${
  sqlFieldNamesForImpl[T]
}

private def sqlFieldNamesForImpl[T: Type](using
    q: Quotes // must be named!!
): Expr[Vector[(String, String)]] =
  import quotes.reflect.*
  val annot = TypeRepr.of[SqlName].typeSymbol
  val tuples: Seq[Expr[(String, String)]] = TypeRepr
    .of[T]
    .typeSymbol
    .primaryConstructor
    .paramSymss
    .flatten
    .collect:
      case sym if sym.hasAnnotation(annot) =>
        val fieldNameExpr = Expr(sym.name.asInstanceOf[String])
        val annotExpr = sym.getAnnotation(annot).get.asExprOf[SqlName]
        '{ ($fieldNameExpr, $annotExpr.sqlName) }
  val seq: Expr[Seq[(String, String)]] = Expr.ofSeq(tuples)
  '{ $seq.toVector }
{% endhighlight %}

And in a different file,

{% highlight scala %}
@main def hello: Unit =
  println(sqlFieldNamesFor[AppUser]) // Vector((lastName,last_name))
{% endhighlight %}

It's weird that the compiler requires the given Quotes to be named, and the error message is pretty cryptic. I've filed a Scala 3 bug: [https://github.com/lampepfl/dotty/issues/18059](https://github.com/lampepfl/dotty/issues/18059)
