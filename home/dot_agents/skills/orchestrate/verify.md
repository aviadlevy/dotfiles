# Verify a worker's MR

You live-test every MR whose plan has pass criteria. The test runs the code CI built for the exact
sha, with only its edges stubbed. The artifact and network rules come from the bindings.

1. **Get the build artifact for the sha.** An expired login → hand the user the `! <login command>`
   to run.
2. **Extract and check it.** Copy it out into scratch. Confirm the entry point exists and starts:
   CI can ship an artifact that builds green and cannot run.
3. **Build the harness.** Drive the real service code; stub only the edges (e.g. Redis, S3, a
   monitor client). The harness prints the observables the pass criteria name.
4. **Run.** Local runs are yours. Network runs against a customer or remote target are the user's:
   hand them `! <script>`. Every such script first checks the route the network binding requires
   and that the target itself answers, and aborts otherwise: an outage on the target invalidates a
   run.
5. **Judge** against the pass criteria from the raw output lines, not a script's own PASS/FAIL
   summary, until that summary code has run once.
6. **Record** the sha, the image, each criterion and its result in `test-log.md`, and send the
   worker the result to put in the MR description as `Live test: ✓ <sha>` (or the failure).
7. **Stale check.** Any later push to the MR → repeat from step 1 on the final sha.

Done when the MR table's live-test cell shows the result for the MR's current sha. Add every
extracted artifact, container and harness dir to the cleanup list.
