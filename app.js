const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());
var format = require("date-fns/format");
var isValid = require("date-fns/isValid");

const dbPath = path.join(__dirname, "todoApplication.db");
let db = null;

const initializeDBAndServer = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Running server http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB ERROR ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertObjectToArray = (eachVal) => {
  const dateVal = eachVal.due_date.split("-");
  var result = format(
    new Date(
      parseInt(dateVal[0]),
      parseInt(dateVal[1] - 1),
      parseInt(dateVal[2])
    ),
    "yyyy-MM-dd"
  );
  return {
    id: eachVal.id,
    todo: eachVal.todo,
    priority: eachVal.priority,
    status: eachVal.status,
    category: eachVal.category,
    dueDate: result,
  };
};

const authenticationToken = (request, response, next) => {
  var statusList = ["TO DO", "IN PROGRESS", "DONE"];
  var priorityList = ["HIGH", "MEDIUM", "LOW"];
  var categoryList = ["WORK", "HOME", "LEARNING"];
  const { search_q = "", category, priority, status } = request.query;
  var is_valid_status = statusList.includes(status);
  var is_valid_priority = priorityList.includes(priority);
  var is_valid_category = categoryList.includes(category);
  if (
    is_valid_status === true ||
    is_valid_priority === true ||
    is_valid_category === true ||
    search_q !== ""
  ) {
    next();
  } else if (is_valid_status === false && status !== undefined) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (is_valid_priority === false && priority !== undefined) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else if (is_valid_category === false && category !== undefined) {
    response.status(400);
    response.send("Invalid Todo Category");
  }
};

const postAuthenticationToken = (request, response, next) => {
  var statusList = ["TO DO", "IN PROGRESS", "DONE"];
  var priorityList = ["HIGH", "MEDIUM", "LOW"];
  var categoryList = ["WORK", "HOME", "LEARNING"];
  const { todo = "", category, priority, status, dueDate } = request.body;
  var is_valid_status = statusList.includes(status);
  var is_valid_priority = priorityList.includes(priority);
  var is_valid_category = categoryList.includes(category);
  var validDate = false;
  if (dueDate !== undefined) {
    const modifiedDate = dueDate.replace(/-/g, ",");
    validDate = isValid(new Date(modifiedDate));
  }
  if (
    is_valid_status === true &&
    is_valid_priority === true &&
    is_valid_category === true &&
    validDate === true
  ) {
    next();
  } else if (is_valid_status === false && status !== undefined) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (is_valid_priority === false && priority !== undefined) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else if (is_valid_category === false && category !== undefined) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else if (validDate === false && dueDate !== undefined) {
    response.status(400);
    response.send("Invalid Due Date");
  } else if (
    is_valid_status === true ||
    is_valid_priority === true ||
    is_valid_category === true ||
    todo !== "" ||
    validDate === true
  ) {
    next();
  }
};

app.get("/todos/", authenticationToken, async (request, response) => {
  const { search_q, category, priority, status } = request.query;
  let selectQuery = "";
  let selectResult = null;
  if (status !== undefined && priority !== undefined) {
    selectQuery = `SELECT * FROM todo WHERE status='${status}' AND priority='${priority}';`;
  } else if (category !== undefined && status !== undefined) {
    selectQuery = `SELECT * FROM todo WHERE category='${category}' AND status='${status}';`;
  } else if (status !== undefined) {
    selectQuery = `SELECT * FROM todo WHERE status='${status}';`;
  } else if (priority !== undefined) {
    selectQuery = `SELECT * FROM todo WHERE priority='${priority}';`;
  } else if (search_q !== undefined) {
    selectQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%';`;
  } else if (category !== undefined) {
    selectQuery = `SELECT * FROM todo WHERE category='${category}';`;
  }
  selectResult = await db.all(selectQuery);
  const res = selectResult.map((eachVal) => convertObjectToArray(eachVal));
  response.send(res);
});

app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const selectQuery = `SELECT * FROM todo WHERE id='${todoId}';`;
  const selectResult = await db.get(selectQuery);
  response.send(convertObjectToArray(selectResult));
});

const isValidDate = (request, response, next) => {
  const { date } = request.query;
  const modifiedDate = date.replace(/-/g, ",");
  const validDate = isValid(new Date(modifiedDate));
  if (validDate) {
    next();
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
};
app.get("/agenda/", isValidDate, async (request, response) => {
  const { date } = request.query;
  const dateVal = date.split("-");
  var resultDate = format(
    new Date(
      parseInt(dateVal[0]),
      parseInt(dateVal[1]) - 1,
      parseInt(dateVal[2])
    ),
    "yyyy-MM-dd"
  );
  const selectQuery = `SELECT * FROM todo WHERE due_date='${resultDate}';`;
  const selectResult = await db.all(selectQuery);
  const res = selectResult.map((eachVal) => convertObjectToArray(eachVal));
  response.send(res);
});

app.post("/todos/", postAuthenticationToken, async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  const dateVal = dueDate.split("-");
  var resultDate = format(
    new Date(
      parseInt(dateVal[0]),
      parseInt(dateVal[1]) - 1,
      parseInt(dateVal[2])
    ),
    "yyyy-MM-dd"
  );

  const insertQuery = `INSERT INTO todo (id,todo,priority,status,category,due_date) VALUES (${id},'${todo}','${priority}','${status}','${category}','${resultDate}');`;
  await db.run(insertQuery);
  response.send("Todo Successfully Added");
});

app.put(
  "/todos/:todoId/",
  postAuthenticationToken,
  async (request, response) => {
    const { todoId } = request.params;
    const { todo, priority, status, category, dueDate } = request.body;
    if (status !== undefined) {
      const updateQuery = `UPDATE todo SET status='${status}' WHERE id=${todoId};`;
      await db.run(updateQuery);
      response.send("Status Updated");
    } else if (priority !== undefined) {
      const updateQuery = `UPDATE todo SET priority='${priority}' WHERE id=${todoId};`;
      await db.run(updateQuery);
      response.send("Priority Updated");
    } else if (todo !== undefined) {
      const updateQuery = `UPDATE todo SET todo='${todo}' WHERE id=${todoId};`;
      await db.run(updateQuery);
      response.send("Todo Updated");
    } else if (category !== undefined) {
      const updateQuery = `UPDATE todo SET category='${category}' WHERE id=${todoId};`;
      await db.run(updateQuery);
      response.send("Category Updated");
    } else if (dueDate !== undefined) {
      const dateVal = dueDate.split("-");
      var resultDate = format(
        new Date(
          parseInt(dateVal[0]),
          parseInt(dateVal[1]),
          parseInt(dateVal[2])
        ),
        "yyyy-MM-dd"
      );
      const updateQuery = `UPDATE todo SET due_date='${resultDate}' WHERE id=${todoId};`;
      await db.run(updateQuery);
      response.send("Due Date Updated");
    }
  }
);

app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteQuery = `DELETE FROM todo WHERE id=${todoId}`;
  await db.run(deleteQuery);
  response.send("Todo Deleted");
});
module.exports = app;
