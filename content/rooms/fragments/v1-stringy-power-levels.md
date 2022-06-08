---
toc_hide: true
---

##### `m.room.power_levels` events accept values as strings

In order to maintain backwards compatibility with early implementations,
each of the integer-valued properties within
[`m.room.power_levels`](/client-server-api#mroompower_levels) events can
be encoded as strings instead of integers. This includes the nested values
within the `events`, `notifications` and `users` properties.
For example, the following is a valid `m.room.power_levels` event in this room version:

```json
{
  "content": {
    "ban": "50",
    "events": {
      "m.room.power_levels": "100"
    },
    "events_default": "0",
    "state_default": "50",
    "users": {
      "@example:localhost": "100"
    },
    "users_default": "0"
  },
  "origin_server_ts": 1432735824653,
  "room_id": "!jEsUZKDJdhlrceRyVU:example.org",
  "sender": "@example:example.org",
  "state_key": "",
  "type": "m.room.power_levels"
}
```

When the value is representative of an integer, they must be the following format:

* a single base 10 integer, no float values or decimal points, optionally with
  any number of leading zeroes (`"100"`, `"000100"`);
* optionally prefixed with a single `-` or `+` character before the integer (`"+100"`,
  `"-100"`).
* optionally with any number of leading or trailing whitespace characters (`" 100 "`,
  `" 00100 "`, `" +100 "`, `" -100 "`);
