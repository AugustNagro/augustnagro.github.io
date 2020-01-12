---
layout: post
title: Fast Universal Hashing in Java
date: 2020-1-11
---

Every Java Object has a `hashCode`, but often many are required. This is Universal Hashing, and tools like Bloom Filters, Count-Min-Sketch, Minimal Perfect Hashing, and other probabilistic datastructures need it to be fast. Some people use a specially designed function like [FNV](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function) or [Murmur](https://en.wikipedia.org/wiki/MurmurHash), but there is a cleaner (and faster) way with just `Object::hashCode`.


For clarity, the interface to be implemented is:

{% highlight java %}
public interface UniversalHash {

  /**
   * Applies the ith Universal Hash Function to this Object.
   * i must be >= 0
   *
   * @param i the ith hash function in this Object's Universal Family.
   */
  int hash(int i);
}
{% endhighlight %}

UniversalHash could be implemented by an existing class, or used to wrap arbitary classes, since all Objects have `hashCode`.


The implementation technique relies on four complimentary *tricks*, the first of which is the Kirsch-Mitzenmacher Optimization, detailed in the paper [Building a Better Bloom Filter](https://www.eecs.harvard.edu/~michaelm/postscripts/tr-02-05.pdf) and mentioned in Donald Knuth's *Art of Computer Programming*. The idea is that only two hash functions are needed to compute any ith hash for an Object obj.


Let `ha = hash_a(obj)` and `hb = hash_b(obj)`. Then the `ith hash function of obj = ha * i + hb`.


Two hash functions is definitely better than having to generate i, and we already have one, `ha = hashCode()`. We could use FNV or Murmur to find `hb`, but once again there's a faster way. Another common trick in hashing is to use a 64 bit hash function, and since each bit should be random, just split the hash. The first 32 bits are `ha`, and second 32 bits are `hb`. With this technique, we can use a 64-bit [Fibonacci Hash](https://en.wikipedia.org/wiki/Hash_function#Fibonacci_hashing) of the object's hashcode using the multiply-shift scheme, which only costs a single multiply. Skeptics will say that Fibonacci hashing is not a good hash function, and they are correct. But we do not need a random 64-bit hash of a 32-bit hash, only that the uniformly-distributed 32-bit hash is fairly mapped into 64-bits, such that collisions are minimized. And Fibonacci Hashing does exactly this; remember that Fibonacci numbers and the Golden Ratio *g* are one and the same ([Binet's formula](https://en.wikipedia.org/wiki/Fibonacci_number#Binet's_formula)), and that *g* is the most irrational of irrational numbers. Just as the Golden Ratio is observed in the arrangement of flower petals, such that overlap is minimized, so will taking the Fibonacci Hash of Object::hashCode distribute it fairly into a 64-bit space. And thus, we can implement class Record:

{% highlight java %}
public class Record<K, V> implements UniversalHash {
  // 2^64 / golden ratio.
  // Negative, because Java long is two's complement.
  private static long G_FACTOR_64 = -7046029254386353131L;

  private final int ha, hb;
  private final K key;
  private final V value;

  public Record(K key, V value) {
    this.key = key; this.value = value;
    long fibHash = key.hashCode() * G_FACTOR_64;
    ha = (int) fibHash;
    hb = (int) (fibHash >>> 32);
  }

  @Override
  public int hash(int i) {
    return ha * i + hb;
  }

  public K key() {
    return key;
  }

  public V value() {
    return value;
  }
}
{% endhighlight %}

Finally, we must consider the reduction step, which itself is a hash function. Most of the time, integer modulo (%) is used to map the hash to an arbitrary range. However, modulo requires division, which is slow, at least compared to the other operations in our Record class. Herein lies the last trick: the [Fast-Range Reduction](https://lemire.me/blog/2016/06/27/a-fast-alternative-to-the-modulo-reduction/). Now, reduction costs only a multiply and shift. So for example,

{% highlight java %}
Record r = new Record(key, value);
int hash_i = r.hash(i);
// int index = h % array.length
int index = (int) ((hash_i & 0xffffffffL) * array.length >>> 32);
array[index] = o;
{% endhighlight %}

This is slightly different than the Fast-Range author's C code, since Java does not have unsigned integers. The `(h & 0xffffffffL)` is used as a poor-man's unsigned widening. Of course, if the array is a power of two, better to copy the Xor-Shift strategy in java.util.Hashmap since C2 can eliminate the array out-of-bounds checks. There is an open issue for Fast-Range: [https://bugs.openjdk.java.net/browse/JDK-8234333](https://bugs.openjdk.java.net/browse/JDK-8234333).


With such arcane optimizations and obscure knowledge, it often feels like the study of hashing is more art than science. It is a good thing then that my University puts Computer Science under the Liberal Arts, a fact my brother in the Engineering college is happy to remind me of.
