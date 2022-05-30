##### Power levels accepted as strings

In order to maintain backwards compatibility with early implementations,
power levels can optionally be represented in string format instead of
integer format. A homeserver must be prepared to deal with this by parsing
the power level from a string. In these cases, the following formatting of the
power level string is allowed:

* a single Base10 integer, no float values or decimal points, optionally with
  any number of leading zeroes (`"100"`, `"000100"`);
* optionally with any number of leading or trailing whitespace characters (`" 100 "`,
  `" 00100 "`);
* optionally prefixed with a single `-` or `+` character before the integer
  but after leading whitespace padding (`" +100 "`, `" -100 "`, `"+100"`,
  `"-100"`).

{{% boxes/note %}}
The integer represented by the string must still be within the `[-2^53, 2^53)`
range accepted by normal, non-string, power level values.
{{% /boxes/note %}}
