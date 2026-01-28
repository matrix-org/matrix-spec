
##### `m.room.power_levels` events accept values as floats

When the value is a float, anything after the decimal point is removed,
making e.g. `5.17`, `5.42`, and `5` functionally identical. 

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
