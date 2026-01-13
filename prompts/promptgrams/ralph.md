ref [what-is-a-promptgram](./what-is-a-promptgram.md)

begin

defer [cleanup](../dev/cleanup.md)

check git diff staged

if clean

    git fetch

    pull master

    find the next ticket to work on in the git project assoc with .

    if there is another ticket

    	work on the ticket ref [implement-ticket](../dev/implement-ticket.md)


    if there are no tickets in the backlog
        look at the existing PRDs
        create the next sensible PRD ref [prd](../product/prd.md)
        create the ERD to go with it ref [erd](../dev/erd.md)
        create the tickets and add them to the project ref [create-tickets-from-erd](../dev/create-tickets-from-erd.md)
        commit and push ref [conventional-commits](../dev/conventional-commits.md)

if not clean
use gh, check the tickets in the project, you're probably working on the current ticket, use whats already staged to figure it out, keep working on the ticket ref [implement-ticket](../dev/implement-ticket.md)

at end ALWAYS [cleanup](../dev/cleanup.md)
