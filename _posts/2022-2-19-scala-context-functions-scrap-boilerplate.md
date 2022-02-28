---
layout: post
title: Scrap Your Boilerplate with Scala 3 Context Functions
date: 2022-2-19
---

We program with contexts all the time. Some examples are Http request time, database transactions, or the ability to suspend a Coroutine.

It quickly gets tedious passing contexts method to method. That's why Spring Boot has annotations like [@Transactional](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html) and [@Async](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/Async.html). But Spring's annotations aren't typesafe, and they don't compose well either. If you write a @Transactional method, and somewhere deep in the callstack an @Async method gets called.. your database state can get corrupted. Fun.

Scala's alternative is implicit parameters.

{% highlight scala %}
def doSomething(user: User)(using Transaction, Async, Time): UserResp = ???
{% endhighlight %}

It's a lot easier then passing the contexts manually, but still annoying having to update method signatures when things change.

Assuming these three contexts are the most common, you can scrap the boilerplate by defining a Scala 3 [Context Function](https://docs.scala-lang.org/scala3/reference/contextual/context-functions.html) type:

{% highlight scala %}
type IO[A] = (Transaction, Async, Time) ?=> A

def doSomething(user: User): IO[UserResp] = ???
{% endhighlight %}

Although equivalent to first example, I thought it would compile to something like this:

{% highlight scala %}
def doSomething(user: User): Function3[Transaction, Async, Time, UserResp] = ???
{% endhighlight %}

But [CRF](https://www.benf.org/other/cfr/) reveals the Scala 3 compiler is quite smart and avoids returning a function:

{% highlight scala %}
def doSomething(user: User, ev$1: Transaction, ev$2: Async, ev$3: Time): UserResp = ???
{% endhighlight %}

Aside: Is it right to call this Context Function type 'IO'?

