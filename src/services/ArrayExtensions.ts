export function innerJoin<TOuter, TInner, TKey, TResult>(outer: TOuter[], inner: TInner[], outerKeySelector: (outer: TOuter) => TKey, innerKeySelector: (inner: TInner) => TKey, resultSelector: (a: TOuter, b: TInner) => TResult) {
    const index = inner.reduce((map, current) => map.set(innerKeySelector(current), current), new Map<TKey, TInner>());
    return outer.map(element => resultSelector(element, index.get(outerKeySelector(element))));
}
