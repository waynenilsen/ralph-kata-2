PRD: 0013
Title: Todo Search
Author: Product
Status: Draft
ERD: [ERD-0013](../erd/0013-todo-search.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

As todo lists grow, users struggle to find specific tasks. They remember a keyword from a todo title or description but must scroll through potentially hundreds of items to locate it. Filtering by status, assignee, or label helps narrow down lists but doesn't help when users need to find a specific todo by its content. Users waste time manually scanning lists instead of instantly finding what they need.

**Who has this problem?**

- Team members with many todos who remember partial titles or keywords
- Team leads looking for a specific task they recall discussing
- Users who created a todo weeks ago and need to reference it
- Anyone trying to avoid duplicate todos by checking if something already exists

**Why solve it now?**

The application now has filtering (PRD-0002), pagination (PRD-0003), labels (PRD-0012), and comments (PRD-0011). With all this content, search becomes essential for productivity. Users expect search as table-stakes functionality in any task management tool. SQLite's full-text search (FTS5) provides a performant solution without external services.

---

## Non-Goals

- Fuzzy matching or typo tolerance (SQLite FTS is exact-match based)
- Search across tenants (data remains isolated)
- Search history or saved searches
- Search suggestions/autocomplete
- Search within file attachments (no attachments exist)
- Advanced query syntax exposed to users (AND/OR/NOT)
- Search result ranking customization
- Search analytics or tracking popular queries
- Real-time search-as-you-type (debounced queries are sufficient)

---

## Success Criteria

**Quantitative:**
- Users can search todos by title content
- Users can search todos by description content
- Search results return in under 200ms for typical queries
- Search respects existing filters (status, assignee, label)
- Search query persists in URL (shareable)
- Empty search shows all results (existing behavior)

**Qualitative:**
- Finding a specific todo feels instant
- Search integrates naturally with existing filter controls
- Users don't need to think about search syntax

---

## Solution

**High-level approach**

Add a search input to the todo list page that filters todos by matching text in title and description. Use SQLite FTS5 for efficient full-text indexing. Search combines with existing filters (AND logic). Results highlight or simply show matching todos.

**User Stories**

```
When I remember a keyword from a todo, I want to search for it, so I can find the task instantly.

When I'm unsure if a todo exists, I want to search before creating, so I avoid duplicates.

When I filter by assignee, I want to also search within those results, so I can find a specific assigned task.

When I share a search with my team, I want the URL to include the query, so they see the same results.
```

**What's in scope**

- Search input field in the filter bar
- Full-text search across todo title and description
- SQLite FTS5 virtual table for efficient indexing
- Search combined with existing filters (status, assignee, label)
- URL-based search state (`?q=keyword`)
- Debounced search input (300ms delay)
- Clear search button (X icon in input)
- Empty state when no results found
- Search within current tenant only

**What's out of scope**

- Searching comments (adds complexity, limited value)
- Highlighting matched terms in results
- Ranking results by relevance (show all matches)
- Search operators exposed to users
- Indexing on other fields (assignee name, label name)
- Search result snippets with context
- Recent searches or search suggestions

---

## UI Patterns

**Search Input**
- Placed in filter bar, before or after existing filter dropdowns
- Placeholder: "Search todos..."
- Search icon on the left
- Clear button (X) appears when text is entered
- Full width on mobile, fixed width on desktop

**Integration with Filters**
- Search AND filters apply together
- Example: status=pending AND q=bug shows pending todos containing "bug"
- Clearing search preserves other filters
- Clearing all filters also clears search

**No Results State**
- Message: "No todos found for '[query]'"
- Suggest clearing search or adjusting filters
- Show "Clear search" button

**Results Display**
- Standard todo card display (no special highlighting)
- Results respect current sort order
- Results are paginated as usual

---

## Technical Approach

**SQLite FTS5**
- Create FTS5 virtual table indexed on todo title and description
- Trigger-based sync keeps FTS table updated on insert/update/delete
- Query uses MATCH operator for performance
- Join FTS results with main todos table for full data

**Alternative: LIKE queries**
- Simpler implementation: `WHERE title LIKE '%query%' OR description LIKE '%query%'`
- Worse performance at scale (no index usage)
- Consider as fallback if FTS5 adds too much complexity

For this PRD, start with FTS5 for proper scalability. Fall back to LIKE only if Prisma integration proves problematic.

---

## Search Behavior

- Case-insensitive matching
- Matches partial words (prefix matching via FTS5 `*` operator)
- Multiple words: match todos containing ALL words (AND logic)
- Minimum query length: 1 character
- Maximum query length: 100 characters
- Special characters stripped or escaped for safety

---

## Prototype

Implementation will use existing shadcn/ui Input component with search icon. FTS5 setup via Prisma raw SQL migration.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model with title and description
- PRD-0002 (Todo Filtering and Sorting) - provides filter infrastructure to extend
- PRD-0003 (Todo Pagination) - search results are paginated
