# K6 lab results

Run on 30 October 2026 with k6 v2.3.0 on Windows, from Thailand, against https://quickpizza.grafana.com.

## Part 0
- Step 0.1, http_req_duration: 251.98 ms (one request, so avg = min = med = max = p(90) = p(95)).
- Step 0.2, requests, rate and p(95), and why the rate stays below 5: 80 requests, 3.84 requests/s, p(95) = 271.46 ms.
  One iteration is one request (about 0.26 s) plus `sleep(1)`, so about 1.26 to 1.29 s (iteration_duration avg 1.29 s).
  One virtual user therefore finishes about 0.78 iterations per second, and 5 users give 5 x 0.78 = about 3.9 requests/s.
  The think time is part of every iteration, so the rate can never reach 5 per second.
  (Step 0.3, 20 iterations with 5 VUs: exactly 20 requests, 3.54 requests/s, p(95) = 271.75 ms.)
- Step 0.6, exit code of the normal run and of the run with P95=300: 0 and 99.
  Normal run: p(95) = 1.01 s < 1500 ms, all three thresholds passed.
  P95=300 run: p(95) = 383.95 ms is not < 300 ms, so the threshold on http_req_duration was crossed.
- Step 0.7, rules that passed, p(95), p(99), exit code after your change:
  `vus: 3`, `duration: '30s'`, thresholds `http_req_failed: rate<0.01`, `http_req_duration: ['p(95)<1000', 'p(99)<1500']`.
  All three rules passed: p(95) = 378.93 ms, p(99) = 406.11 ms, failed = 0.00%, exit code 0.
  After the change (p(95) limit from 1000 to 200 ms, run with `-e P95=200`): p(95) = 383.01 ms, rule failed, exit code 99.
- Step 0.8, what was wrong, and how the checks showed it:
  The script sent `excludedIngredients: ['pepperoni']` and `excludedTools: ['knife']` in lower case.
  `explore.js` shows that QuickPizza names are capitalised: the topping is `Pepperoni` and the tool is `Knife`
  (tools are `Knife`, `Pizza cutter`, `Scissors`). The API compares the names exactly and silently ignores a name it
  does not know, so it returned pizzas with Pepperoni and pizzas that need a Knife, still with status 200.
  In the first run the check `no knife needed` failed in 3 of 6 responses (50%), so half of the pizzas needed a knife.
  Fix: use `'Pepperoni'` and `'Knife'`. After the fix `no knife needed` passed every time, and
  `no pepperoni` failed only together with `status is 200`.
  Those remaining failures were not wrong pizzas: 4 or 5 of the 13 to 20 requests in each run ended with status 0,
  a TCP read timeout ("connected party did not properly respond"). The body is empty then, so `r.json()` throws and
  the pepperoni check fails too. I could not get 100% of checks on my network, and I did not find the cause (it may
  be the shared site, or my connection). Every response that did arrive had no Pepperoni and no Knife.
  Why load found it: one manual request can be lucky, because the pizza is random and may contain no pepperoni by
  chance, and a single call also hides rare failures. Many requests under load give the bug many chances to show,
  and a check that reads the body (not only the status code) turns a wrong answer with status 200 into a visible number.

## Part A results
| Step | Test type    | Users | Req/s | p(95)  | Max      | Failed | Checks             |
| ---- | ------------ | ----- | ----- | ------ | -------- | ------ | ------------------ |
| A1   | Smoke        | 1     | 0.46  | 381 ms | 400 ms   | 0.00%  | 100% (20 of 20)    |
| A2   | Average load | 3     | 1.30  | 494 ms | 1.50 s   | 0.00%  | 100% (316 of 316)  |
| A3   | Stress       | 5     | 2.12  | 522 ms | 1.07 s   | 0.00%  | 100% (524 of 524)  |
| A4   | Spike        | 5     | 1.05  | 365 ms | 654 ms   | 0.00%  | 100% (204 of 204)  |
| A5   | Soak         | 2     | 0.83  | 624 ms | 103.18 s | 0.00%  | 100% (764 of 764)  |

All thresholds passed in A1 to A5 (exit code 0). HTML reports are in `reports/`.

## Part B
1. See the table above.
2. In Step 0.2 one iteration is a request of about 0.26 s plus a 1 s sleep, about 1.29 s. One user does about
   0.78 requests/s, and 5 users do 3.84 requests/s, below 5, because the think time is inside every iteration.
3. Yes, but only a little. p(95) went from 494 ms (3 users) to 522 ms (5 users), +6%; the average went from
   319 ms to 312 ms, so it did not grow, and the max went down from 1.50 s to 1.07 s. The difference is inside the
   normal noise of a shared site, and the A2 p(95) had a few slow requests of its own. Both loads are far inside
   the operational envelope of QuickPizza: 5 users make only about 2 requests/s, and the site answered with the same
   speed and 0% failures. So this test shows that the system keeps its promise inside the envelope. It cannot show
   how the system slows down beyond the envelope, because the lab rules do not let us go there.
4. The spike (1 to 5 users from 30 s to 35 s, back to 1 user at about 65 s to 70 s) did not raise the response
   time in a way I can measure. From the 10 s windows of the report, p(95) was 320 to 360 ms before the spike,
   339 to 357 ms during it, and 319 to 370 ms after it; the biggest max was 459 ms. So the recovery time was about
   0 seconds: there was nothing to recover from, and the whole run had p(95) = 365 ms and max 654 ms.
5. No clear trend. Failed stayed at 0.00% and all checks passed. The response time was about 340 to 380 ms in the
   first minutes, and in the last minutes it was in the same range (310 to 480 ms), with short bursts in between
   (window p(95) up to 1.4 s at 2.5 min, 1.6 s at 3 min and 2.4 s at 6.5 min), each one gone in the next 10 to
   20 seconds. These bursts are not a rising line, so they point to the internet path or the shared site, not to a
   leak in the system. The whole run had p(95) = 624 ms, and a max of 103 s for one request that the 10 s windows
   of the report do not show (I did not find which request it was, so I treat it as a network or site hang).
   A soak test of several hours could reveal a memory leak (memory grows until the server is slow or crashes), and
   also leaks of database connections, file handles or threads, or a log or disk that slowly fills up.
6. The average hides the slowest users. One request in 20 is slower than p(95), and a few very slow requests do not
   move the average much. Example from A5: the average was 522 ms, but the max was 103 s. Users feel the slow
   requests, so a requirement such as "95% of requests within 1 s" describes the experience better than an average.
7. (a) A lab system is on the same network as the test machine, so there is no internet latency, jitter or packet
   loss, and the numbers are lower and more stable (here 250 ms of every request is mostly network round trip).
   (b) A lab system is not shared: on QuickPizza other learners send traffic at the same time and we do not know the
   hardware, caching or the load balancer, while in a lab we control the hardware, the data and the other load, so
   the result can be repeated. The k6 machine itself (CPU, Wi-Fi) also changes the numbers.
8. A big stress, spike or breakpoint test looks like a DoS attack. It can slow down or crash the site for its real
   users and other learners, cost the owner money, and break the law or the terms of use. We have no permission, and
   a breakpoint test is meant to break the system. So run it only on a system you own or with written permission,
   preferably in a test environment.
9. App: a food delivery app.
   Vague requirement: "The restaurant list must load fast, also when many people order at lunch."
   Testable requirement: "With 50 users at the same time for 5 minutes, GET /api/restaurants answers 95% of requests
   within 800 ms and 99% within 2 s, and fewer than 1% of requests fail."
   ```js
   export const options = {
     stages: [
       { duration: '1m', target: 50 },
       { duration: '5m', target: 50 },
       { duration: '30s', target: 0 },
     ],
     thresholds: {
       http_req_duration: ['p(95)<800', 'p(99)<2000'],
       http_req_failed: ['rate<0.01'],
       checks: ['rate>0.99'],
     },
   };
   ```
