---
layout: post
title: "JVM Startup Times"
date: 2017-6-9
---

The JVM's Achilles heel is long startup times. This is especially true for Scala programs, which require megabytes of additional jars on the classpath. On my 2015 i5 8gb ram Macbook Pro with Scala 2.12.2 and Java 8, the following takes over one second to execute:

{% highlight bash %}
$ cat S.scala
object S { def main(args: Array[String]): Unit = println("hello world") }

$ time scala S.scala
hello world

real  0m1.107s
user  0m0.953s
sys   0m0.106s
{% endhighlight %}
An equivalent C program is nearly instantaneous:
{% highlight bash %}
$ cat C.cpp 
#include <stdio.h>

int main(void) {
  printf("hello world\n");
  return 0;
}

$ gcc C.cpp -o C
$ time ./C
hello world

real  0m0.004s
user  0m0.001s
sys   0m0.001s
{% endhighlight %}
Python is also much faster:
{% highlight bash %}
$ cat P.py 
print("hello world")

$ time python P.py 
hello world

real  0m0.029s
user  0m0.015s
sys   0m0.009s
{% endhighlight %}

Using `time` is not a scientific means of benchmarking, but is illustrative enough to show Scala's handicap. Being a common frustration of the world's most engineered virtual machine, significant effort has been invested in mechanisms to lower coldstart numbers. These include JVM features like Class Data Sharing (CDS), AppCDS, Modular Runtime Images, Ahead of Time Compilation, and third party devlopments such as Scala Native and Nailgun. 

But first, startup time can be improved using the tools provided. A simple speedup is compiling `S.scala` beforehand:

{% highlight bash %}
$ scalac S.scala

$ time scala S
hello world

real  0m0.741s
user  0m0.866s
sys   0m0.097s
{% endhighlight %}

Packaging the class in a jar yields similar execution time:

{% highlight bash %}
cds $ scalac S.scala -d s.jar

cds $ time scala s.jar
hello world

real  0m0.722s
user  0m0.809s
sys   0m0.088s

cds $ time scala -classpath s.jar S
hello world

real  0m0.747s
user  0m0.869s
sys   0m0.102s
{% endhighlight %}

It turns out that the `scala` script calls java with every library in $SCALA_HOME/lib on the classpath. This includes libraries like `scala-compiler.jar` and `scala-reflect.jar`, totaling 20MB. That's a lot for the JVM to load on every startup.

{% highlight bash %}
$ du -hs /usr/local/Cellar/scala/2.12.2/libexec/lib/
 20M	/usr/local/Cellar/scala/2.12.2/libexec/lib/
$ du -hs /usr/local/Cellar/scala/2.12.2/libexec/lib/*
264K	/usr/local/Cellar/scala/2.12.2/libexec/lib/jline-2.14.3.jar
9.2M	/usr/local/Cellar/scala/2.12.2/libexec/lib/scala-compiler.jar
5.0M	/usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar
208K	/usr/local/Cellar/scala/2.12.2/libexec/lib/scala-parser-combinators_2.12-1.0.5.jar
3.4M	/usr/local/Cellar/scala/2.12.2/libexec/lib/scala-reflect.jar
720K	/usr/local/Cellar/scala/2.12.2/libexec/lib/scala-swing_2.12-2.0.0.jar
536K	/usr/local/Cellar/scala/2.12.2/libexec/lib/scala-xml_2.12-1.0.6.jar
500K	/usr/local/Cellar/scala/2.12.2/libexec/lib/scalap-2.12.2.jar
{% endhighlight %}
As the hello world example only requires `scala-library.jar`, including just this archive on the classpath begets significant improvement:

{% highlight bash %}
$ time java -cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar:s.jar S
hello world

real  0m0.464s
user  0m0.557s
sys   0m0.053s
{% endhighlight %}

## CDS

[Class Data Sharing](http://docs.oracle.com/javase/8/docs/technotes/guides/vm/class-data-sharing.html) circumvents long class-loading times by caching the JVM's internal representation of system jars and memory-mapping them in during startup. The possibly outdated docs note that CDS requires the Serial GC and Hotspot Client VM. As the `-client` option has been ignored on 64 bit machines for many years, it's unlikely this feature works on my computer.

CDS is enabled 'whenever possible', but my installation required regenerating the shared archive:

{% highlight bash %}
$ java -Xshare:on
An error has occurred while processing the shared archive file.
Specified shared archive not found.
Error occurred during initialization of VM
Unable to use shared archive.

$ sudo touch /Library/Java/JavaVirtualMachines/jdk1.8.0_131.jdk/Contents/Home/jre/lib/server/classes.jsa

$ sudo chmod 777 /Library/Java/JavaVirtualMachines/jdk1.8.0_131.jdk/Contents/Home/jre/lib/server/classes.jsa

$ java -Xshare:dump
java -Xshare:dump
Allocated shared space: 37871616 bytes at 0x0000000800000000
Loading classes to share ...
Preload Warning: Cannot find com/apple/laf/ImageCache
Preload Warning: Cannot find com/apple/laf/ImageCache$1
Preload Warning: Cannot find com/apple/laf/ImageCache$PixelCountSoftReference
Preload Warning: Cannot find java/awt/GraphicsEnvironment$1
Preload Warning: Cannot find java/lang/UNIXProcess$2
Preload Warning: Cannot find java/lang/UNIXProcess$3
Preload Warning: Cannot find java/lang/UNIXProcess$4
Preload Warning: Cannot find java/lang/UNIXProcess$ProcessReaperThreadFactory
Preload Warning: Cannot find java/lang/UNIXProcess$ProcessReaperThreadFactory$1
Preload Warning: Cannot find java/lang/invoke/MagicLambdaImpl
Preload Warning: Cannot find java/security/ProtectionDomain$3
Preload Warning: Cannot find javax/swing/JComponent$2
Preload Warning: Cannot find javax/swing/text/AbstractDocument$InsertStringResult
Preload Warning: Cannot find sun/font/CFontManager$4
Preload Warning: Cannot find sun/java2d/Disposer$2
Preload Warning: Cannot find sun/java2d/opengl/OGLRenderQueue$1
Preload Warning: Cannot find sun/lwawt/macosx/CPlatformWindow$14
Preload Warning: Cannot find sun/lwawt/macosx/LWCToolkit$5
Preload Warning: Cannot find sun/lwawt/macosx/event/NSEvent
Loading classes to share: done.
Rewriting and linking classes ...
Rewriting and linking classes: done
Number of classes 2202
    instance classes   =  2188
    obj array classes  =     6
    type array classes =     8
Calculating fingerprints ... done. 
Removing unshareable information ... done. 
Shared Lookup Cache Table Buckets = 8216 bytes
Shared Lookup Cache Table Body = 65832 bytes
ro space:   5679592 [ 35.4% of total] out of  16777216 bytes [33.9% used] at 0x0000000800000000
rw space:   8935272 [ 55.7% of total] out of  16777216 bytes [53.3% used] at 0x0000000801000000
md space:   1400192 [  8.7% of total] out of   4194304 bytes [33.4% used] at 0x0000000802000000
mc space:     34053 [  0.2% of total] out of    122880 bytes [27.7% used] at 0x0000000802400000
total   :  16049109 [100.0% of total] out of  37871616 bytes [42.4% used]
{% endhighlight %}

Using CDS has very little impact:

{% highlight bash %}
$ time java -Xshare:on -cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar:s.jar S
hello world

real  0m0.447s
user  0m0.545s
sys   0m0.053s
{% endhighlight %}

{% highlight bash %}
time java -client -XX:+UseSerialGC -Xshare:on -cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar:s.jar S
hello world

real  0m0.436s
user  0m0.532s
sys   0m0.050s
{% endhighlight %}

## AppCDS

[App CDS](http://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html#app_class_data_sharing) is an experimental and commerical feature enabling CDS on both the system and application classpath.

Following the guide we create `s.classlist`:

{% highlight bash %}
$ java -Xshare:off -XX:+UnlockCommercialFeatures -XX:DumpLoadedClassList=s.classlist \
-XX:+UseAppCDS -cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar:s.jar S
{% endhighlight %}
Use it to generate a custom `s.jsa` cache,
{% highlight bash %}
$ java -XX:+UnlockCommercialFeatures -Xshare:dump -XX:+UseAppCDS \
-XX:SharedArchiveFile=s.jsa -XX:SharedClassListFile=s.classlist \
-cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar:s.jar
{% endhighlight %}
And then run with the archive:
{% highlight bash %}
$ time java -XX:+UnlockCommercialFeatures -Xshare:on -XX:+UseAppCDS \
-XX:SharedArchiveFile=s.jsa \
-cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar:s.jar S
hello world

real  0m0.173s
user  0m0.226s
sys   0m0.035s
{% endhighlight %}
A big improvement.

## Modular Runtime Images

[Jlink](http://openjdk.java.net/jeps/282) is part of Java 9's Project Jigsaw and builds custom runtime images. Scala doesn't yet support Java 9, so Java sources were used.

With the compiled `Main.java`, startup is ~100ms in JDK 8
{% highlight bash %}
$ cat Main.scala
public class Main {
  public static void main(String[] args) {
    System.out.println("hello world");
   }
}
$ time java Main
hello world

real  0m0.096s
user  0m0.073s
sys   0m0.022s
{% endhighlight %}
After switching to JDK9 and building a jre image:
{% highlight bash %}
$ jlink --module-path $JAVA_HOME/jmods:mlib --add-modules com.greetings \
--output greetingapp --launcher

$ time ./greetingapp/bin/java -m com.greetings/com.greetings.Main
Greetings!

real  0m0.202s
user  0m0.092s
sys   0m0.039s
{% endhighlight %}
Quite a bit [slower](https://stackoverflow.com/questions/35180051/is-there-startup-time-regression-in-java-9-ea). The custom jre is very small, though:
{% highlight bash %}
$ du -hs greetingapp/
35MB	greetingapp/
{% endhighlight %}
My java 8 jre folder is 178MB.

## Nailgun

Avoiding startup time completly is possible with [Nailgun](http://martiansoftware.com/nailgun/). Start a background server with:

{% highlight bash %}
$ brew install nailgun
$ java -jar /usr/local/Cellar/nailgun/0.9.1/libexec/nailgun-server-0.9.1.jar 
NGServer 0.9.1 started on all interfaces, port 2113.
{% endhighlight %}
Add the required jars

{% highlight bash %}
$ ng ng-cp /usr/local/Cellar/scala/2.12.2/libexec/lib/scala-library.jar
$ ng ng-cp s.jar
{% endhighlight %}
And after the first run (in which the jars are loaded) execution rivals C:
{% highlight bash %}
$ ng S
hello world
$ time ng S
hello world

real  0m0.006s
user  0m0.001s
sys   0m0.002s
{% endhighlight %}

This is by far the fastest method on the JVM. Nailgun is partially responsible for the incredibly fast compile times of [CBT (Chris's Build Tool)](https://github.com/cvogt/cbt).

## Scala Native and AOT compilation. 

[Scala Native](scala-native.org) and JDK 9's [AOT compilation](http://openjdk.java.net/jeps/295) achieve great startup performance but lose the JDK's most compelling benefits like JIT and platform-agnostic execution in the process. Anyone skeptical of these managed language features should consider [this talk](https://www.youtube.com/watch?v=Pz-4co8IaI8&feature=youtu.be). If your application requires sub 200 milisecond response times (sub 100ms for plain java) and Nailgun is not an option, they're the best bet. 

## Update 6 August 2017:
It's also possible to improve startup time by removing usage of Scala's standard library. In this case `scala.Predef.println` was replaced with `System.out.println`:
{% highlight bash %}
$ cat Main.scala 
object Main {
  def main(args: Array[String]): Unit = {
    System.out.println("Hello World")
  }
}
$ scalac Main.scala
$ time java Main
Hello World

real  0m0.093s
user  0m0.072s
sys   0m0.021s
{% endhighlight %}
To keep convenience methods like `println`, consider [this article](http://august.nagro.us/removing-scala-predef.html)
