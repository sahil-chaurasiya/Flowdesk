/**
 * Run an Express-style controller `(req, res, next)` in-process and capture the
 * JSON it would have sent. Lets the unified overview reuse each module's OWN
 * dashboard controller, so the numbers always follow that module's business
 * rules instead of a second, drifting implementation.
 */
function captureController(handler, reqLike = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => done({ status: 504, body: { message: 'timed out' } }), timeoutMs);

    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      set() { return this; },
      setHeader() { return this; },
      json(body) { done({ status: this.statusCode, body }); return this; },
      send(body) { done({ status: this.statusCode, body }); return this; },
    };
    const req = { query: {}, params: {}, body: {}, headers: {}, ...reqLike };
    try {
      Promise.resolve(handler(req, res, (err) => done({ status: 500, body: { message: err?.message || 'error' } })))
        .catch((err) => done({ status: 500, body: { message: err?.message || 'error' } }));
    } catch (err) {
      done({ status: 500, body: { message: err.message } });
    }
  });
}

module.exports = { captureController };
