---
toc_hide: true
---

The room state *S′(E)* after an event *E* is defined in terms of the
room state *S(E)* before *E*, and depends on whether *E* is a state
event or a message event:

-   If *E* is a message event, then *S′(E)* = *S(E)*.
-   If *E* is a state event, then *S′(E)* is *S(E)*, except that its
    entry corresponding to the `event_type` and `state_key` of *E* is
    replaced by the `event_id` of *E*.

The room state *S(E)* before *E* is the *resolution* of the set of
states {*S′(E*<sub>1</sub>*)*, *S′(E*<sub>2</sub>*)*, …}
after the `prev_event`s {*E*<sub>1</sub>, *E*<sub>2</sub>, …} of *E*.
The resolution of a set of states is given in the algorithm below.

#### Definitions

The state resolution algorithm for version 2 rooms uses the following
definitions, given the set of room states
{*S*<sub>1</sub>, *S*<sub>2</sub>, …}:

**Power events.**
A *power event* is a state event with type `m.room.power_levels` or
`m.room.join_rules`, or a state event with type `m.room.member` where
the `membership` is `leave` or `ban` and the `sender` does not match the
`state_key`. The idea behind this is that power events are events that
might remove someone's ability to do something in the room.

**Unconflicted state map and conflicted state set.**
The keys of the state maps *S<sub>i</sub>* are 2-tuples of strings of the form
*K* = `(event_type, state_key)`. The values *V* are state events.
The key-value pairs (*K*, *V*) across all state maps *S<sub>i</sub>* can be 
divided into two collections.
If a given key *K* is present in every *S<sub>i</sub>* with the same value *V* 
in each state map, then the pair (*K*, *V*) belongs to the *unconflicted state map*.
Otherwise, *V* belongs to the *conflicted state set*.

Note that the unconflicted state map only has one event for each key *K*,
whereas the conflicted state set may contain multiple events with the same key.

**Auth chain.**
The *auth chain* of an event *E* is the set containing all of *E*'s auth events,
all of *their* auth events, and so on recursively, stretching back to the
start of the room. Put differently, these are the events reachable by walking
the graph induced by an event's `auth_events` links.

**Auth difference.**
The *auth difference* is calculated by first calculating the full auth
chain for each state *S*<sub>*i*</sub>, that is the union of the auth
chains for each event in *S*<sub>*i*</sub>, and then taking every event
that doesn't appear in every auth chain. If *C*<sub>*i*</sub> is the
full auth chain of *S*<sub>*i*</sub>, then the auth difference is
 ∪ *C*<sub>*i*</sub> −  ∩ *C*<sub>*i*</sub>.

**Full conflicted set.**
The *full conflicted set* is the union of the conflicted state set and
the auth difference.

**Reverse topological power ordering.**
The *reverse topological power ordering* of a set of events is the
lexicographically smallest topological ordering based on the DAG formed
by auth events. The reverse topological power ordering is ordered from
earliest event to latest. For comparing two topological orderings to
determine which is the lexicographically smallest, the following
comparison relation on events is used: for events *x* and *y*,
*x* &lt; *y* if

1.  *x*'s sender has *greater* power level than *y*'s sender, when
    looking at their respective `auth_event`s; or
2.  the senders have the same power level, but *x*'s `origin_server_ts`
    is *less* than *y*'s `origin_server_ts`; or
3.  the senders have the same power level and the events have the same
    `origin_server_ts`, but *x*'s `event_id` is *less* than *y*'s
    `event_id`.

The reverse topological power ordering can be found by sorting the
events using Kahn's algorithm for topological sorting, and at each step
selecting, among all the candidate vertices, the smallest vertex using
the above comparison relation.

**Mainline ordering.**
Let *P* = *P*<sub>0</sub> be an `m.room.power_levels` event.
Starting with *i* = 0, repeatedly fetch *P*<sub>*i*+1</sub>, the
`m.room.power_levels` event in the `auth_events` of *P<sub>i</sub>*.
Increment *i* and repeat until *P<sub>i</sub>* has no `m.room.power_levels`
event in its `auth_events`.
The *mainline of P*<sub>0</sub> is the list of events
    [*P*<sub>0</sub> , *P*<sub>1</sub>, ... , *P<sub>n</sub>*],
fetched in this way.

Let *e* = *e<sub>0</sub>* be another event (possibly another
`m.room.power_levels` event). We can compute a similar list of events
    [*e*<sub>1</sub>, ..., *e<sub>m</sub>*],
where *e*<sub>*j*+1</sub> is the `m.room.power_levels` event in the
`auth_events` of *e<sub>j</sub>* and where *e<sub>m</sub>* has no
`m.room.power_levels` event in its `auth_events`. (Note that the event we
started with, *e<sub>0</sub>*, is not included in this list. Also note that it
may be empty, because *e* may not cite an `m.room.power_levels` event in its
`auth_events` at all.)

Now compare these two lists as follows.
* Find the smallest index *j* ≥ 1 for which *e<sub>j</sub>* belongs to the
   mainline of *P*.
* If such a *j* exists, then *e<sub>j</sub>* = *P<sub>i</sub>* for some unique
  index *i* ≥ 0. Otherwise set *i* = ∞, where ∞ is a sentinel value greater
  than any integer.
* In both cases, the *mainline position* of *e* is *i*.

Given mainline positions calculated from *P*, the *mainline ordering based on* *P* of a set of events is the ordering,
from smallest to largest, using the following comparison relation on
events: for events *x* and *y*, *x* &lt; *y* if

1.  the mainline position of *x* is **greater** than
    the mainline position of *y* (i.e. the auth chain of 
    *x* is based on an earlier event in the mainline than *y*); or
2.  the mainline positions of the events are the same, but *x*'s
    `origin_server_ts` is *less* than *y*'s `origin_server_ts`; or
3.  the mainline positions of the events are the same and the events have the
    same `origin_server_ts`, but *x*'s `event_id` is *less* than *y*'s
    `event_id`.

**Iterative auth checks.**
The *iterative auth checks algorithm* takes as input an initial room
state and a sorted list of state events, and constructs a new room state
by iterating through the event list and applying the state event to the
room state if the state event is allowed by the [authorization
rules](/server-server-api#authorization-rules).
If the state event is not allowed by the authorization rules, then the
event is ignored. If a `(event_type, state_key)` key that is required
for checking the authorization rules is not present in the state, then
the appropriate state event from the event's `auth_events` is used if
the auth event is not rejected.

#### Algorithm

The *resolution* of a set of states is obtained as follows:

1.  Select all *power events* that appear in the *full conflicted set*. Compute
    the union of their auth chains, including the power events themselves.
    Sort the union using the *reverse topological power ordering*.
2.  Apply the *iterative auth checks algorithm*, starting from the
    *unconflicted state map*, to the list of events from the previous
    step to get a partially resolved state.
3.  Take all remaining events that weren't picked in step 1 and order
    them by the mainline ordering based on the power level in the
    partially resolved state obtained in step 2.
4.  Apply the *iterative auth checks algorithm* on the partial resolved
    state and the list of events from the previous step.
5.  Update the result by replacing any event with the event with the
    same key from the *unconflicted state map*, if such an event exists,
    to get the final resolved state.

#### Rejected events

Events that have been rejected due to failing auth based on the state at
the event (rather than based on their auth chain) are handled as usual
by the algorithm, unless otherwise specified.

Note that no events rejected due to failure to auth against their auth
chain should appear in the process, as they should not appear in state
(the algorithm only uses events that appear in either the state sets or
in the auth chain of the events in the state sets).

{{% boxes/rationale %}}
This helps ensure that different servers' view of state is more likely
to converge, since rejection state of an event may be different. This
can happen if a third server gives an incorrect version of the state
when a server joins a room via it (either due to being faulty or
malicious). Convergence of state is a desirable property as it ensures
that all users in the room have a (mostly) consistent view of the state
of the room. If the view of the state on different servers diverges it
can lead to bifurcation of the room due to e.g. servers disagreeing on
who is in the room.

Intuitively, using rejected events feels dangerous, however:

1.  Servers cannot arbitrarily make up state, since they still need to
    pass the auth checks based on the event's auth chain (e.g. they
    can't grant themselves power levels if they didn't have them
    before).
2.  For a previously rejected event to pass auth there must be a set of
    state that allows said event. A malicious server could therefore
    produce a fork where it claims the state is that particular set of
    state, duplicate the rejected event to point to that fork, and send
    the event. The duplicated event would then pass the auth checks.
    Ignoring rejected events would therefore not eliminate any potential
    attack vectors.
{{% /boxes/rationale %}}

Rejected auth events are deliberately excluded from use in the iterative
auth checks, as auth events aren't re-authed (although non-auth events
are) during the iterative auth checks.
