---
layout: post
title: "Giter8 Scala Templates"
date: 2016-12-2
---
Defending the configuration of my Scala templates.

Contents:

<ol>
    <li><a href="#general-configuration">General Configuration</a></li>
    <li><a href="#scala-minimal">Scala Minimal</a></li>
    <li><a href="#scala-maven">Scala Maven</a></li>
    <li><a href="scalajs-minimal">ScalaJS Minimal</a></li>
    <li><a href="#scalajs-modular">ScalaJS Modular</a></li>
    <li><a href="#play">Play</a></li>
</ol>

### General Configuration
In every scala template, the below scalac options are included, and are detailed at [Recommended scalac options](https://august.nagro.us/Recommended-scalac-Options.html)

{% highlight scala %}
    scalacOptions ++= Seq(
      "-deprecation",
      "-unchecked",
      "-target:jvm-1.8",
      "-encoding", "UTF-8",
      "-Xfuture",
      "-Yno-adapted-args",
      "-Ywarn-dead-code",
      "-Ywarn-numeric-widen",
      "-Ywarn-value-discard",
      "-Ywarn-unused",
      "-feature",
      "-Xlint"
    )
{% endhighlight %}

[ScalaCheck](http://www.scalacheck.org/), an automated property-based testing framework, is often more robust than traditional unit tests, and can integrate with [ScalaTest](http://www.scalatest.org/), [uTest](https://github.com/lihaoyi/utest), and [spec2](http://etorreborre.github.io/specs2/)

Sbt's [cached dependency resolution](http://www.scala-sbt.org/0.13/docs/Cached-Resolution.html) is an experiemental feature, but often improves compile time for projects.

{% highlight scala %}
    updateOptions := updateOptions.value.withCachedResolution(true)
{% endhighlight %}

Each template is licenced under [Creative Commons Zero v1.0](http://choosealicense.com/licenses/cc0-1.0/#).

### Scala Minimal
A no frills Scala template. Initialized with `sbt new augustnagro/s.g8`. and includes the general configuration above.

Source at [https://github.com/augustnagro/s.g8](https://github.com/augustnagro/s.g8)

### Scala Maven
Template for projects being published to Sonatype / Maven Central.

`sbt new augustnagro/smaven.g8`
 
Relevant SBT Docs:
* [Publishing](http://www.scala-sbt.org/0.13/docs/Publishing.html)
* [Deploying to Sonatype](http://www.scala-sbt.org/0.13/docs/Using-Sonatype.html)

Source at [https://github.com/augustnagro/sMaven.g8](https://github.com/augustnagro/sMaven.g8)

### ScalaJS Minimal
A [non-modular](https://scalacenter.github.io/scalajs-bundler/motivation.html) Scala.js template.

`sbt new augustnagro/sjs.g8`

Source at [http://github.com/augustnagro/sjs.g8](http://github.com/augustnagro/sjs.g8)

### ScalaJS Modular
[Modular](https://scalacenter.github.io/scalajs-bundler/motivation.html) Scala.js template. This is the best solution for managing lots of npm dependencies, but causes a big increase in build time.

`sbt new augustnagro/sjsmod.g8`

Source at [http://github.com/augustnagro/sjsMod.g8](http://github.com/augustnagro/sjsMod.g8)

### Play
Multi-project build with Scala.js

`sbt new augustnagro/play.g8`

Source at [http://github.com/augustnagro/play.g8](http://github.com/augustnagro/play.g8)
