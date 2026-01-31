
    const sql = require("mssql");

module.exports = async function (context, req) {
  // 1) CORS / preflight
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
    return;
  }

  const connStr = process.env.SQL_CONNECTION_STRING;
  if (!connStr) {
    context.res = { status: 500, body: "Brak SQL_CONNECTION_STRING" };
    return;
  }

  const ok = (status, body) => ({
    status,
    body,
    headers: { "Access-Control-Allow-Origin": "*" },
  });

  try {
    // ✅ Poprawka: bierzemy pool i robimy request przez pool.request()
    const pool = await sql.connect(connStr);

    // 2) GET - pobierz board
    if (req.method === "GET") {
      const user = (req.query.user || "").trim();
      const year = parseInt(req.query.year, 10);
      const month = (req.query.month || "").trim();

      if (!user || !year || !month) {
        context.res = ok(400, { message: "Brak parametrow: user, year, month" });
        return;
      }

      const result = await pool
        .request() // ✅ zamiast sql.request() / new sql.Request()
        .input("userName", sql.NVarChar(100), user)
        .input("year", sql.Int, year)
        .input("month", sql.Char(2), month)
        .query(
          `SELECT dataJson
           FROM dbo.WorklogBoard
           WHERE userName=@userName AND [year]=@year AND [month]=@month`
        );

      if (result.recordset.length === 0) {
        context.res = ok(200, null);
        return;
      }

      const dataJson = result.recordset[0].dataJson;
      context.res = ok(200, JSON.parse(dataJson));
      return;
    }

    // 3) POST - zapisz board
    if (req.method === "POST") {
      const body = req.body || {};
      const user = (body.user || "").trim();
      const year = parseInt(body.year, 10);
      const month = (body.month || "").trim();
      const data = body.data;

      if (!user || !year || !month || !data) {
        context.res = ok(400, { message: "Brak w body: user, year, month, data" });
        return;
      }

      const dataJson = JSON.stringify(data);

      await pool
        .request() // ✅ zamiast sql.request() / new sql.Request()
        .input("userName", sql.NVarChar(100), user)
        .input("year", sql.Int, year)
        .input("month", sql.Char(2), month)
        .input("dataJson", sql.NVarChar(sql.MAX), dataJson)
        .query(
          `MERGE dbo.WorklogBoard AS t
           USING (SELECT @userName AS userName, @year AS [year], @month AS [month]) AS s
           ON (t.userName = s.userName AND t.[year] = s.[year] AND t.[month] = s.[month])
           WHEN MATCHED THEN
             UPDATE SET dataJson=@dataJson, updatedAt=SYSDATETIME()
           WHEN NOT MATCHED THEN
             INSERT (userName, [year], [month], dataJson, updatedAt)
             VALUES (@userName, @year, @month, @dataJson, SYSDATETIME());`
        );

      context.res = ok(200, { ok: true });
      return;
    }

    context.res = ok(405, { message: "Method not allowed" });
  } catch (err) {
    context.log.error("API ERROR:", err);
    context.res = ok(500, { message: "Błąd", error: err.message });
  } finally {
    // opcjonalnie zamykamy
    try {
      await sql.close();
    } catch {}
  }
};
