---
layout: post
title: "Removing scala.Predef for scala-library.jar Independence"
date: 2017-8-6
---
Completely removing scala.Predef can be enforced by the compiler with option `-Yno-predef`. In addition to changing default type signatures and functions, removing Predef lets one become independent of Scala's collections library. `scalac` compiled `.class` and `.jar` files can then be directly executed with `java`, without having to add the 5 megabyte `scala-library.jar` to the classpath.

To keep Predef's ease-of-use definitions like `println` and `implicitly`, copy Predef directly from [source](https://github.com/scala/scala/blob/v2.11.8/src/library/scala/Predef.scala#L1), or re-implement choice members. This is the implementation in [https://github.com/AugustNagro/s.g8](https://github.com/AugustNagro/s.g8):

```scala
package com.example

import scala.annotation.elidable
import scala.annotation.elidable.ASSERTION

object Predef {
  @inline final def implicitly[A](implicit evidence: A): A = evidence

  @elidable(ASSERTION)
  @inline final def assert(assertion: Boolean): Unit =
    if(!assertion) throw new java.lang.AssertionError("assertion failed")

  @elidable(ASSERTION)
  @inline final def assert(assertion: Boolean, message: => Any): Unit =
    if(!assertion) throw new java.lang.AssertionError("assertion failed" + message)

  @inline final def print(i: Int): Unit = System.out.print(i)
  @inline final def print(c: Char): Unit = System.out.print(c)
  @inline final def print(s: String): Unit = System.out.print(s)
  @inline final def print(f: Float): Unit = System.out.print(f)
  @inline final def print(d: Double): Unit = System.out.print(d)
  @inline final def print(l: Long): Unit = System.out.print(l)
  @inline final def print(b: Boolean): Unit = System.out.print(b)
  @inline final def print(s: Array[Char]): Unit = System.out.print(s)
  @inline final def print(obj: AnyRef): Unit = System.out.print(obj)

  @inline final def println(i: Int): Unit = System.out.println(i)
  @inline final def println(c: Char): Unit = System.out.println(c)
  @inline final def println(s: String): Unit = System.out.println(s)
  @inline final def println(f: Float): Unit = System.out.println(f)
  @inline final def println(d: Double): Unit = System.out.println(d)
  @inline final def println(l: Long): Unit = System.out.println(l)
  @inline final def println(b: Boolean): Unit = System.out.println(b)
  @inline final def println(s: Array[Char]): Unit = System.out.println(s)
  @inline final def println(obj: AnyRef): Unit = System.out.println(obj)

}
```
