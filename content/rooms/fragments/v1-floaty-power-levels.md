
##### `m.room.power_levels` events accept values as floats

When the value is a float
 * First, exponential notation is applied: `5.114698E4` becomes `51146.98`
 * Second, the value is truncated at the decimal point: `51146.98` becomes `51146`.

Values outside the range represented by IEE754 binary64 (a "double") cause the
powerlevel event to be rejected, as do `Infinity`, `-Infinity` and `NaN`.

For example, this is a valid `m.room.power_levels` event in this room version:

```json
{
  "content": {
    "ban": 50,
    "events": {
      "m.room.power_levels": 100
    },
    "events_default": 0,
    "state_default": 50,
    "users": {
      "@example:example.org": 100,
      "@alice:localhost": 50,
      "@bob:localhost": 50.57
    },
    "users_default": 0
  },
  "origin_server_ts": 1432735824653,
  "room_id": "!jEsUZKDJdhlrceRyVU:example.org",
  "sender": "@example:example.org",
  "state_key": "",
  "type": "m.room.power_levels"
}
```

In this example, both `@bob:localhost` and `@alice:localhost` have the same effective
power level of `50`, even though the values are technically different.

Note that, since this room version does not enforce that events comply with the requirements
of [Canonical JSON](/appendices#canonical-json), power levels can be formatted as floats.
