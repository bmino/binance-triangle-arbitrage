# Depth Sizes

Internally the app maintains a copy of the order book. This order book's bid and ask depth is configured via `DEPTH.SIZE`.


### How Local Order Book is Maintained

Websocket connections keep the local order book up to date, but when the app starts up, the order book for each tracked symbol must be initialized.
This is accomplished by requesting a snapshot of the order book from Binance via a REST call.
These REST requests have a weight associated with them which can overwhelm the weighted request limit if `DEPTH.SIZE` is too big.
This is because higher depth values have a higher weight assigned by Binance.

---

**Q**. When should I increase `DEPTH.SIZE`?

**A**. If you are getting many performance errors about the depth cache being too shallow or are trading with a high `INVESTMENT.MAX`

---

**Q**. When should I decrease `DEPTH.SIZE`?

**A**. If you are trading with small values for `INVESTMENT.MAX` you can reduce `DEPTH.SIZE` for faster calculation cycles

---

**Q**. How high should I increase `DEPTH.SIZE`?

**A**. Values higher than `100` could lead to an IP ban on startup without using `TRADING.WHITELIST`

---
