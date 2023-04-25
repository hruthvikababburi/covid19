const express = require("express");
const app = express();

app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const dbObjectToResponseObjStates = (eachObj) => {
  return {
    stateId: eachObj.state_id,
    stateName: eachObj.state_name,
    population: eachObj.population,
  };
};

const dbObjectToResponseObjDistrict = (eachObj) => {
  return {
    districtId: eachObj.district_id,
    districtName: eachObj.district_name,
    stateId: eachObj.state_id,
    cases: eachObj.cases,
    cured: eachObj.cured,
    active: eachObj.active,
    deaths: eachObj.deaths,
  };
};

const convertJsonStateNameToResponseState = (Obj) => {
  return {
    stateName: Obj.state_name,
  };
};

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
};

initializeDbAndServer();

const authenticateLoggerMiddleware = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET", async (error, payload) => {
      if (error) {
        response.status(400);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//user login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetailsQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}';`;
  const userDetails = await db.get(getUserDetailsQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyPassword = await bcrypt.compare(password, userDetails.password);
    if (verifyPassword !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET");
      response.send({ jwtToken });
    }
  }
});

//get states Array
app.get("/states/", authenticateLoggerMiddleware, async (request, response) => {
  const getStatesArrayQuery = `
    SELECT *
    FROM state;`;
  const getStatesArray = await db.all(getStatesArrayQuery);
  response.send(
    getStatesArray.map((each) => dbObjectToResponseObjStates(each))
  );
});

//get state by Id

app.get(
  "/states/:stateId/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};`;
    const getState = await db.get(getStateQuery);
    response.send(dbObjectToResponseObjStates(getState));
  }
);

//create new district

app.post(
  "/districts/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const createNewDistrictQuery = `
    INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
    const newDistrict = await db.run(createNewDistrictQuery);
    response.send("District Successfully Added");
  }
);

//get district by id

app.get(
  "/districts/:districtId/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;
    const getDistrict = await db.get(getDistrictQuery);
    response.send(dbObjectToResponseObjDistrict(getDistrict));
  }
);

//delete district

app.delete(
  "/districts/:districtId/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};`;
    const deltedDistrict = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//update district details

app.put(
  "/districts/:districtId/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictDetailsQuery = `
    UPDATE district
    SET district_name = '${districtName}', state_id = ${stateId}, cases = ${cases} ,cured = ${cured}, active = ${active}, deaths = ${deaths};`;
    const updatedDistrictDetails = await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

//get data of cases bsed on stateId

app.get(
  "/states/:stateId/stats/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const { stateId } = request.params;
    const getCasesDataQuery = `
    SELECT SUM(cases), SUM(cured) , SUM(active) , SUM(deaths) 
    FROM district
    WHERE state_id = ${stateId};`;
    const getCasesData = await db.get(getCasesDataQuery);

    response.send({
      totalCases: getCasesData["SUM(cases)"],
      totalCured: getCasesData["SUM(cured)"],
      totalActive: getCasesData["SUM(active)"],
      totalDeaths: getCasesData["SUM(deaths)"],
    });
  }
);

//get state name by district id

app.get(
  "/districts/:districtId/details/",
  authenticateLoggerMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateNameByDisIdQuery = `
SELECT state.state_name
FROM state NATURAL JOIN district
WHERE district_id = ${districtId};`;
    const getStateName = await db.get(getStateNameByDisIdQuery);
    response.send(convertJsonStateNameToResponseState(getStateName));
  }
);

module.exports = app;
