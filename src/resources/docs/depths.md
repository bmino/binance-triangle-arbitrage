# Depth Sizes

Internally the app maintains a synced copy of the order book. This order book's bid and ask depth is configured via `SCANNING.DEPTH`.


### How Local Order Book is Initialized

Websocket connections keep the local order book up to date, but when the app starts up, the order book for each tracked symbol must be initialized.
This is accomplished by requesting a snapshot of the order book from Binance via a REST call.
These REST requests have a weight associated with them which can overwhelm the weighted request limit if `SCANNING.DEPTH` is too big.
This is because higher depth values have a higher weight assigned by Binance.

---

**Q**. What are valid depth sizes for the order book REST request?

**A**. [5, 10, 20, 50, 100, 500, 1000, 5000]

---

**Q**. What happens if I use a `SCANNING.DEPTH` value other than those listed above?

**A**. The local order book will be initialized with the lowest value above that will satisfy your provided `SCANNING.DEPTH` value

---

**Q**. When should I increase `SCANNING.DEPTH`?

**A**. If you are getting many performance errors about the depth cache being too shallow or are trading with a high `INVESTMENT.MAX`

---

**Q**. When should I decrease `SCANNING.DEPTH`?

**A**. If you are trading with small values for `INVESTMENT.MAX` you can reduce `SCANNING.DEPTH` for faster calculation cycles

---

**Q**. How high should I increase `SCANNING.DEPTH`?

**A**. Values higher than `100` could lead to an IP ban on startup without using `SCANNING.WHITELIST`

---
