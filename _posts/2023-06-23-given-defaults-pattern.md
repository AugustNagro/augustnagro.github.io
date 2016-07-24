---
layout: post
title: "The 'Given Defaults Pattern': How to Implement Class Defaults with a Macro in Scala 3"
date: 2023-06-23
---

The database client [Magnum](https://github.com/AugustNagro/magnum) has Repositories, which derive common SQL statements like findById, insert, and update at compile-time.

{% highlight scala %}
@Table(PostgresDbType, SqlNameMapper.CamelToSnakeCase)
case class User(
  @Id id: Long,
  firstName: Option[String],
  lastName: String,
  created: OffsetDateTime
) derives DbCodec

val userRepo = Repo[User, User, Long]

val countAfterUpdate = transact(ds):
  userRepo.deleteById(2L)
  userRepo.count
{% endhighlight %}

How does this work? One might think that `Repo.apply` is a macro, but it's not. Instead, `Repo` is an [open class](https://docs.scala-lang.org/scala3/reference/other-new-features/open-classes.html#) designed for extension. Users can subclass `Repo` (or its supertype `ImmutableRepo`) to encapsulate and organize their queries:

{% highlight scala %}
class UserRepo extends ImmutableRepo[User, Long]:
  def firstNamesForLast(lastName: String)(using DbCon): Vector[String] =
    sql"""
      SELECT DISTINCT first_name
      FROM user
      WHERE last_name = $lastName
      """.query[String].run()
        
  // other User-related queries here
{% endhighlight %}

The way Repositories work in Magnum is by the 'Given Defaults' pattern. Looking at the definition of ImmutableRepo, we see it requires a given RepoDefaults parameter.

{% highlight scala %}
open class Repo[EC, E, ID](using defaults: RepoDefaults[EC, E, ID])
    extends ImmutableRepo[E, ID]:

  /** Deletes an entity using its id */
  def delete(entity: E)(using DbCon): Unit = defaults.delete(entity)

  /** Deletes an entity using its id */
  def deleteById(id: ID)(using DbCon): Unit = defaults.deleteById(id)

  /** Deletes ALL entities */
  def truncate()(using DbCon): Unit = defaults.truncate()

  // and so on
{% endhighlight %}

`RepoDefaults` is a trait that implements the default behavior of the Repo. If a user seeks to override any methods, they are free to do so.

{% highlight scala %}
trait RepoDefaults[EC, E, ID]:
  def count(using DbCon): Long
  def existsById(id: ID)(using DbCon): Boolean
  def findAll(using DbCon): Vector[E]
  // and so on
{% endhighlight %}


When compiling `val userRepo = Repo[User, User, Long]` or similar, Scala's implicit search looks for a given `RepoDefault` in the companion object, and finds the [Scala 3 macro](https://docs.scala-lang.org/scala3/reference/metaprogramming/macros.html#).

{% highlight scala %}
object RepoDefaults:
  inline given genRepo[
      EC: DbCodec: Mirror.Of,
      E: DbCodec: Mirror.Of,
      ID: ClassTag
  ]: RepoDefaults[EC, E, ID] = ${ genImpl[EC, E, ID] }
{% endhighlight %}

## Conclusions

The UX of this pattern is incredible and is appropriate for any Macro that wants to allow user extension.