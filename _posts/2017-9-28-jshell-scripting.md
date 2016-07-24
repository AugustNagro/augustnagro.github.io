---
layout: post
title: "Scripting in Java"
date: 2017-9-28
---
Java is often ridiculed for its verbosity.

<p align="center"><blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr"><a href="https://twitter.com/hashtag/280characters?src=hash&amp;ref_src=twsrc%5Etfw">#280characters</a><br><br>almost enough to do Hello World in Java</p>&mdash; I Am Devloper (@iamdevloper) <a href="https://twitter.com/iamdevloper/status/912955304383533056?ref_src=twsrc%5Etfw">September 27, 2017</a></blockquote><script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script></p>

While less of a concern in large applications that require readability and structure, Java’s garrulity and compilation requirement has made it an uncommon choice for scripting. With the introduction of [JShell](https://docs.oracle.com/javase/9/jshell/introduction-jshell.htm), Java 9’s new REPL, the language can finally be leveraged from an interpreted context. Consider:

{% highlight bash %}
$ cat helloworld.jsh
/open PRINTING
println(“Hello world”)
/exit

$ jshell helloworld.jsh
Hello world
{% endhighlight %}
Note that `/open PRINTING` imports methods like `print` and `printf` without requiring the `System.out` prefix. By default, many classes in the standard library are automatically imported (try executing `/imports` in a console). The print statement does not require a semicolon, and the script ends with the `/exit` command.

Unfortunately, the depth of features in JShell severely hinders its startup performance. On my 2015 Macbook Pro, the above script takes over 7 seconds. Hopefully, features like Ahead of Time compilation or Class Data Sharing will improve speeds.

Alternatively, the Nashorn javascript engine included with the JDK can be used for scripting. Able to access nearly all of the Java standard library, Nashorn also executes faster, taking less than a second for hello-world:

{% highlight bash %}
$ cat jjs.js
print(“Hello world”);

$ jjs jjs.js
Hello world
{% endhighlight %}

In any case, great strides are being made in Java’s accessibility, and I look forward to further tooling development. 

