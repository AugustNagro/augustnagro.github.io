---
layout: post
title: Beat Parallel Streams with CountedCompleter
date: 2019-12-16
---
Parallel processing is an optimization. So if a problem demands parallelization, you should make sure the computational model is as performant as possible.

This leads to my claim:

> For nearly every parallel workload, a custom [CountedCompleter](https://docs.oracle.com/en/java/javase/13/docs/api/java.base/java/util/concurrent/CountedCompleter.html) subclass will significantly outperform parallel Streams.

Of course Parallel Streams use CountedCompleter internally via [AbstractTask](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/stream/AbstractTask.java), but this post will show that the one-size-fits-all implementation is suboptimal in many scenerios.

1. [Big Ideas: what are ForkJoinPool, ForkJoinTask, and CountedCompleter?](#big-ideas)
2. [Optimizing CountedCompleter](#optimizing-countedcompleter)
3. [Benchmarks](#benchmarks)

### Big Ideas
Java's Fork-Join Framework ([ForkJoinPool](https://docs.oracle.com/en/java/javase/13/docs/api/java.base/java/util/concurrent/ForkJoinPool.html), [ForkJoinTask](https://docs.oracle.com/en/java/javase/13/docs/api/java.base/java/util/concurrent/ForkJoinTask.html), [CountedCompleter](https://docs.oracle.com/en/java/javase/13/docs/api/java.base/java/util/concurrent/CountedCompleter.html)) is superior to thread pools for non-blocking parallelism, thanks to the framework's work-stealing and recursion. ForkJoinTask subclasses like RecursiveAction, RecursiveTask, and CountedCompleter are submitted to the ForkJoinPool, and either recursivly split off new tasks, or execute some computation. Of the three concrete ForkJoinTasks, CountedCompleter is the most efficient, since it avoids the blocking of `join()` by providing its own continuations. And while CountedCompleter is somewhat less straightforward to program, it is not as conceptually challenging as the JavaDoc would suggest.

Consider a simple map-reduce operation done over a large array:

{% highlight java %}
long res = 0;
for (int i : array)
	if (i < 150) res += fnv(i) % bucketSize;
{% endhighlight %}

Here, we iterate over the array, filter the elements so that all are less than 150, map `i` to the [Fowler-Noll-Vo hash function](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function) reduced to `bucketSize`, and then add the result to `res`.

The parallel streams version is:

{% highlight java %}
Arrays.stream(arr)
	.parallel()
	.filter(i -> i < 150)
	.mapToLong(i -> fnv(i) % 5)
	.sum();
{% endhighlight %}

And such a task can be easily parallelized with CountedCompleter. First, we create the initial task:

<p align="center"><img src="/images/cc/task-0.svg" class="img-responsive" alt="task 0"></p>

Which spawns two sub-tasks and increments the volatile pendingCount by 2:

<p align="center"><img src="/images/cc/task-1.svg" class="img-responsive" alt="task 1"></p>

And again, until we reach the desired number of sub-tasks (next section discusses optimal choice):

<p align="center"><img src="/images/cc/task-2.svg" class="img-responsive" alt="task 2"></p>

Lets say we stop splitting here. When a task completes it decrements its own pending count, but if the pending count is already zero, then the parent's pending count is decremented if possible:

<p align="center"><img src="/images/cc/task-3.svg" class="img-responsive" alt="task 3"></p>

And so on:

<p align="center"><img src="/images/cc/task-4.svg" class="img-responsive" alt="task 4"></p>

When the root task's pending count is zero, the job is effectively completed.

### Optimizing CountedCompleter
The graph above is very close to what java.util.Stream's AbstractTask accomplishes. But because we're operating on an array of fixed size, there are several optimizations we can employ. First, conider the target number of tasks. It's reasonable to set a value like 4 * #cores, like in AbstractTask. But some problems may benefit from much more, especially if the processing time is irregular. But on the other side of the coin, more sub-tasks means more allocations and greater framework overhead. So it's not a good idea to spawn a task per array item. Additionally, if many jobs are being submitted to the same pool, [ForkJoinTask::getSurplusQueuedTaskCount](https://docs.oracle.com/en/java/javase/13/docs/api/java.base/java/util/concurrent/ForkJoinTask.html#getSurplusQueuedTaskCount()) can be used to dynamically decide whether to spawn sub-tasks. For my sub-class, I'll stick with 4 * #cores.

Another factor to consider is the minimum number of operations per 'leaf' sub-task. If you only have 16 array elements and four cpu cores, it will be faster to just processes all elements on a single core, rather than giving four to each core (at least for my FNV example). The Fork-Join authors recommend a ops/leaf minimum between 2,000 and 10,000. Since the fnv map-reduce is so simple, I'll use 10,000.

The biggest improvement is when we realize that the 'node' tasks don't actually perform useful computation, but only spawn and wait for other sub-tasks. And because every node spawns a maximum of only two sub-tasks, this means that there's a large ammount of work-stealing contention early on, as threads compete for a small number of tasks (that don't perform useful computation). Let's rearrange the graph. 
From the root node, we keep dividing our array by two and forking sub-tasks until the target size is reached. If the array is size 1,000, and the target is 250, we initially have:

<p align="center"><img src="/images/cc/task-5.svg" class="img-responsive" alt="task 5"></p>

And when compute in task B is called:

<p align="center"><img src="/images/cc/task-6.svg" class="img-responsive" alt="task 6"></p>

We can even compute the pending count in advance! (see computeInitialPending). The full implementation is only 66 lines long:

{% highlight java %}
	static final class CustomCC extends CountedCompleter<Long> {
		private static final int TARGET_LEAVES = Runtime.getRuntime().availableProcessors() << 2;
		// ie, every leaf should be process at least 10_000 elements
		private static final int MIN_SIZE_PER_LEAF = 10_000;

		private static int computeInitialPending(int size) {
			// if x = size / MIN_SIZE_PER_LEAF, and x < TARGET_LEAVES, create x leaves instead.
			// This ensures that every leaf does at least MIN_SIZE_PER_LEAF operations.
			int leaves = Math.min(TARGET_LEAVES, size / MIN_SIZE_PER_LEAF);
			// If the total # leaves = 0, then pending = 0 since we shouldn't fork.
			// Otherwise, pending = log2(leaves), as explained in the benchmark doc
			return leaves == 0
				? 0
				: 31 - Integer.numberOfLeadingZeros(leaves);
		}

		final int[] arr;
		int pos, size;
		long res = 0;
		final CustomCC[] subs;

		public CustomCC(int[] arr) {
			this(null, arr, arr.length, 0, computeInitialPending(arr.length));
		}

		private CustomCC(CustomCC parent, int[] arr, int size, int pos, int pending) {
			super(parent, pending);
			this.arr = arr; this.size = size; this.pos = pos;
			subs = new CustomCC[pending];
		}

		@Override
		public void compute() {
			// subs.length === getPendingCount()
			for (int p = subs.length - 1; p >= 0; --p) {
				size >>>= 1;
				CustomCC sub = new CustomCC(this, arr, size, pos + size, p);
				subs[p] = sub;
				sub.fork();
			}

			// needed for c2 to remove array index checking... modified from java's Spliterator class
			int[] a; int i, hi;
			if ((a = arr).length >= (hi = pos + size) && (i = pos) >= 0 && i < hi) {
				do {
					int e = a[i];
					if (e < 150) res += fnv(e) % 5;
				} while (++i < hi);
			}

			tryComplete();
		}

		@Override
		public void onCompletion(CountedCompleter<?> caller) {
			for (CustomCC sub : subs) res += sub.res;
		}

		@Override
		public Long getRawResult() {
			return res;
		}
	}
{% endhighlight %}

### Benchmarks

Running on a 40 Core Xeon E5-2660 v3 @ 2.60GHz, I got the following results for a random array of size 50 million

<p align="center"><img src="/images/cc/50mil-jmh.png" class="img-responsive" alt="50-mil jmh"></p>

Performance similarly holds for small arrays, since we consider the minimum elements per leaf:

<p align="center"><img src="/images/cc/1000-jmh.png" class="img-responsive" alt="1000 jmh"></p>
<p align="center"><img src="/images/cc/100-jmh.png" class="img-responsive" alt="100 jmh"></p>

And at a few more sizes:

<p align="center"><img src="/images/cc/1mil-jmh.png" class="img-responsive" alt="1-mil jmh"></p>
<p align="center"><img src="/images/cc/3mil-jmh.png" class="img-responsive" alt="3-mil jmh"></p>

### Conclusion

Don't use parallel streams, unless for prototyping or one-off jobs... a tailored CountedCompleter sub-class is much better!

### Benchmark Source, and Raw JMH Results

{% highlight java %}
/**
 * 40 Core Xeon E5-2660 v3 @ 2.60GHz
 *
 * Benchmark                                 (choice)   Mode  Cnt        Score      Error  Units
 * forkJoinBench.Main.customCC                 0  thrpt   15  3206592.104 ± 1457.036  ops/s
 * forkJoinBench.Main.customCC                 1  thrpt   15    23593.980 ±    9.608  ops/s
 * forkJoinBench.Main.customCC                 2  thrpt   15      391.796 ±    1.615  ops/s
 * forkJoinBench.Main.customCC                 3  thrpt   15      115.990 ±    0.190  ops/s
 * forkJoinBench.Main.customCC                 4  thrpt   15       81.434 ±    1.050  ops/s
 * forkJoinBench.Main.fixedLeavesWithAddrCC         0  thrpt   15  3171634.153 ± 2528.279  ops/s
 * forkJoinBench.Main.fixedLeavesWithAddrCC         1  thrpt   15    20110.623 ±    6.119  ops/s
 * forkJoinBench.Main.fixedLeavesWithAddrCC         2  thrpt   15      349.003 ±    0.662  ops/s
 * forkJoinBench.Main.fixedLeavesWithAddrCC         3  thrpt   15      114.049 ±    3.281  ops/s
 * forkJoinBench.Main.fixedLeavesWithAddrCC         4  thrpt   15       68.890 ±    1.241  ops/s
 * forkJoinBench.Main.parallelStream                0  thrpt   15    23671.085 ±  252.414  ops/s
 * forkJoinBench.Main.parallelStream                1  thrpt   15    21285.229 ±  261.597  ops/s
 * forkJoinBench.Main.parallelStream                2  thrpt   15      256.318 ±   13.717  ops/s
 * forkJoinBench.Main.parallelStream                3  thrpt   15       67.165 ±    0.197  ops/s
 * forkJoinBench.Main.parallelStream                4  thrpt   15       40.167 ±    0.086  ops/s
 * forkJoinBench.Main.serial                        0  thrpt   15  3250371.613 ± 1751.204  ops/s
 * forkJoinBench.Main.serial                        1  thrpt   15    22931.864 ±    9.380  ops/s
 * forkJoinBench.Main.serial                        2  thrpt   15       22.846 ±    0.117  ops/s
 * forkJoinBench.Main.serial                        3  thrpt   15        7.644 ±    0.025  ops/s
 * forkJoinBench.Main.serial                        4  thrpt   15        4.583 ±    0.028  ops/s
 *
 */
@BenchmarkMode(Mode.Throughput)
@State(Scope.Benchmark)
@Measurement(iterations = 15)
@Fork(1)
public class Main {
	// just some verification that the numbers are correct
	public static void main(String[] args) throws ExecutionException, InterruptedException {
		Main m = new Main();
		m.arr = arrays[3];
		System.out.println("serial: " + m.serial()
			+ "\nparallelStream: " + m.parallelStream()
			+ "\ncustomCC: " + m.customCC());
	}

	static final int[][] arrays = new int[][] {
		new int[100], new int[10000], new int[10_000_000], new int[30_000_000], new int[50_000_000]
	};

	static {
		Random rand = new Random();
		for (int[] arr : arrays) {
			for (int i = 0; i < arr.length; ++i) arr[i] = rand.nextInt(200);
		}
	}

	@Param({"0", "1", "2", "3", "4"})
	int choice;
	int[] arr;

	@Setup(Level.Trial)
	public void setup() {
		arr = arrays[choice];
	}

	@Benchmark
	public long serial() {
		long res = 0;
		for (int i : arr) if (i < 150) res += fnv(i) % 5;
		return res;
	}

	@Benchmark
	public long parallelStream() {
		return Arrays.stream(arr)
			.parallel()
			.filter(i -> i < 150)
			.mapToLong(i -> fnv(i) % 5)
			.sum();
	}

	@Benchmark
	public long customCC() {
		return new CustomCC(arr).invoke();
	}

	static final class CustomCC extends CountedCompleter<Long> {
		private static final int TARGET_LEAVES = Runtime.getRuntime().availableProcessors() << 2;
		// ie, every leaf should be process at least 10_000 elements
		private static final int MIN_SIZE_PER_LEAF = 10_000;

		private static int computeInitialPending(int size) {
			// if x = size / MIN_SIZE_PER_LEAF, and x < TARGET_LEAVES, create x leaves instead.
			// This ensures that every leaf does at least MIN_SIZE_PER_LEAF operations.
			int leaves = Math.min(TARGET_LEAVES, size / MIN_SIZE_PER_LEAF);
			// If the total # leaves = 0, then pending = 0 since we shouldn't fork.
			// Otherwise, pending = log2(leaves), as explained in the benchmark doc
			return leaves == 0
				? 0
				: 31 - Integer.numberOfLeadingZeros(leaves);
		}

		final int[] arr;
		int pos, size;
		long res = 0;
		final CustomCC[] subs;

		public CustomCC(int[] arr) {
			this(null, arr, arr.length, 0, computeInitialPending(arr.length));
		}

		private CustomCC(CustomCC parent, int[] arr, int size, int pos, int pending) {
			super(parent, pending);
			this.arr = arr; this.size = size; this.pos = pos;
			subs = new CustomCC[pending];
		}

		@Override
		public void compute() {
			// subs.length === getPendingCount()
			for (int p = subs.length - 1; p >= 0; --p) {
				size >>>= 1;
				CustomCC sub = new CustomCC(this, arr, size, pos + size, p);
				subs[p] = sub;
				sub.fork();
			}

			// needed for c2 to remove array index checking... modified from java's Spliterator class
			int[] a; int i, hi;
			if ((a = arr).length >= (hi = pos + size) && (i = pos) >= 0 && i < hi) {
				do {
					int e = a[i];
					if (e < 150) res += fnv(e) % 5;
				} while (++i < hi);
			}

			tryComplete();
		}

		@Override
		public void onCompletion(CountedCompleter<?> caller) {
			for (CustomCC sub : subs) res += sub.res;
		}

		@Override
		public Long getRawResult() {
			return res;
		}
	}

	static final long FNV_64_PRIME  = 0x100000001b3L;
	static final long FNV_64_OFFSET = 0xcbf29ce484222325L;
	static long fnv(int x) {
		long h = FNV_64_OFFSET;
		h ^= (x >>> 24);
		h *= FNV_64_PRIME;
		h ^= (x >>> 16) & 0xff;
		h *= FNV_64_PRIME;
		h ^= (x >>> 8) & 0xff;
		h *= FNV_64_PRIME;
		h ^= x & 0xff;
		h *= FNV_64_PRIME;
		return h;
	}
}
{% endhighlight %}
