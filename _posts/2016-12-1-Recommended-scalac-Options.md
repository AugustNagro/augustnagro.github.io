---
layout: post
title: "Recommended scalac Options"
date: 2016-12-1
---

*Threat Stack* recently published a sound review of scala's compiler flags. Here's the archived links:

* [Part 1](https://web.archive.org/web/20161202041743/http://blog.threatstack.com/useful-scalac-options-for-better-scala-development-part-1)
* [Part2](https://web.archive.org/web/20161202042342/http://blog.threatstack.com/useful-scala-compiler-options-part-2-advanced-language-features)
* [Part 3](https://web.archive.org/web/20161202042442/http://blog.threatstack.com/useful-scala-compiler-options-part-3-linting)

In summary, the following options are recommended:

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
