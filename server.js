// es-module -> import, commonjs -> require
const express = require("express"); // express 안에 이미 구현되어 있는 코드들을 express 객체 형태로 불러오겠다.

const app = express(); // () -> 호출해서 사용하겠다.
// 포트 -> 1 ~ 2xxxx. => 특정한 번호로...
const port = 3000; // cra. next -> express. / 5173
// localhost -> 3000. / 5500? <-> 구분해주는 의미

// get, post...
// app.방식(접속경로, 핸들러)
// localhost:3000/
app.get("/", (req, res) => {
  // req -> request -> 전달 받은 데이터나 요청사항
  // res -> response -> 응답할 내용/방식을 담은 객체
  res.send("bye");
});

// DOM listener / server '대기' -> 특정한 요청 -> 응답
app.listen(port, () => {
  console.log(`서버가 ${port}번 포트에서 실행중입니다.`);
});
