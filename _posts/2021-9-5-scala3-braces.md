---
layout: post
title: Braces in Scala 3 aren't just Optional, they're Consistent
date: 2021-9-5
---

[Scala 3](https://docs.scala-lang.org/scala3/new-in-scala3.html) adds [Optional Braces](https://docs.scala-lang.org/scala3/reference/other-new-features/indentation.html) to the language. At first I was concerned the two different styles would cause confusion and ambiguity, but over time I've realized the new scheme actually makes the language more consistent.

For example, consider a one-line method declaration. In both Scala 2 & 3, braces are optional:

{% highlight scala %}
def helloWorld: Unit = println("Hello, world!")
{% endhighlight %}

If requirements change and you have to refactor, Scala 2 costs several keystrokes to add braces:

{% highlight scala %}
def helloWorld: Unit = {
  val name = Properties.propOrElse("user.name", "world")
  println(s"Hello, $name!")
}
{% endhighlight %}

But with Scala 3, just insert a line break.

{% highlight scala %}
def helloWorld: Unit =
  val name = Properties.propOrElse("user.name", "world")
  println(s"Hello, $name!")
{% endhighlight %}

Another example; consider lambdas. Often they are one-liners,

{% highlight scala %}
users.map(u => s"Hello, $u!").mkString(", ")
{% endhighlight %}

But eventually refactored to multi-line:

{% highlight scala %}
users
  .map(u => {
    val name = u.name.trim
    s"Hello, $name!"
  })
  .mkString(", ")
{% endhighlight %}

The multi-line version in Scala 2 requires braces that seem downright obnoxious after exposure to Scala 3.

{% highlight scala %}
users
  .map(u =>
    val name = u.name.trim
    s"Hello, $name!"
  )
  .mkString(", ")
{% endhighlight %}

These same principles extend to all the other braceless constructs, like if-then-else, while, and for-yield.

There are still instances where braces are needed, like [by-name parameters](https://docs.scala-lang.org/tour/by-name-parameters.html), context functions, or pattern matching inside map{}.

But overall, the braceless syntax is faster, easier to refactor, and more beautiful than the alternative. At least we’re not arguing about tabs-vs-spaces.


