## Performance Review

Performance review depth depends on the preset.
For the fast preset, report only performance issues with clear production impact (data loss risk, user-visible latency, resource exhaustion).

Evaluate for concrete performance problems — only report what is visible in the diff or changed code context:
- N+1 query patterns: loops that issue a DB/API call per iteration instead of batching
- Unbounded data fetching: queries or list reads with no LIMIT, page size, or cursor
- Missing pagination on list endpoints that could return unbounded result sets
- Synchronous/blocking operations that should be async (blocking the event loop, thread pool starvation)
- Unnecessary re-renders in UI components: missing memoization, unstable object/function references passed as props
- Expensive computation inside render paths or hot loops without caching or memoization
- Large allocations or data copies inside tight loops
- Sequential awaits that could be parallelised with Promise.all / concurrent fetches

Avoid:
- Speculative performance claims without evidence from the diff
- Micro-optimisations that have no measurable user impact
- Flagging patterns that are idiomatic and acceptable at the current scale
