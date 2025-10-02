// es-module -> import, commonjs -> require
const express = require("express"); // express 안에 이미 구현되어 있는 코드들을 express 객체 형태로 불러오겠다.
const cors = require("cors"); // 설치한 의존성 패키지 cors를 불러오기
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js"); // 구조분헤 할당
const { GoogleGenAI } = require("@google/genai");
const { Groq } = require("groq-sdk");
dotenv.config(); // .env -> KEY => SUPABASE_KEY
// NODE -> process.env (환경변수) // cf. env file

// const supabaseKey = process.env.SUPABASE_KEY;
// const supabaseUrl = process.env.SUPABASE_URL;
const { SUPABASE_KEY: supabaseKey, SUPABASE_URL: supabaseUrl } = process.env;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express(); // () -> 호출해서 사용하겠다.
// 포트 -> 1 ~ 2xxxx. => 특정한 번호로...
const port = 3000; // cra. next -> express. / 5173
// localhost -> 3000. / 5500? <-> 구분해주는 의미

// CORS 해결을 위한 미들웨어 적용
app.use(cors()); // 모든 출처에 대한 허용 (보안적으로 바람직하지 X)
app.use(express.json()); // req.body -> json

// get, post...
// app.방식(접속경로, 핸들러)
// localhost:3000/
app.get("/", (req, res) => {
  // req -> request -> 전달 받은 데이터나 요청사항
  // res -> response -> 응답할 내용/방식을 담은 객체
  // res.send("bye");
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/plans", async (req, res) => {
  const { data, error } = await supabase.from("tour_plan").select("*");

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

app.post("/plans", async (req, res) => {
  const plan = req.body;
  const result = await chaining(plan);
  plan.ai_suggestion = result;
  // 최종적으로 작성된 계획 -> 최소/최대 경비
  const { minBudget, maxBudget } = await ensemble(result);
  plan.ai_min_budget = minBudget;
  plan.ai_max_budget = maxBudget;
  const { error } = await supabase.from("tour_plan").insert(plan);
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.status(201).json();
});

app.delete("/plans", async (req, res) => {
  const { planId } = req.body;
  const { error } = await supabase
    .from("tour_plan") // table
    .delete() // 삭제
    .eq("id", planId); // eq = equal -> id == planId 삭제
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).json(); // noContent
});

// DOM listener / server '대기' -> 특정한 요청 -> 응답
app.listen(port, () => {
  console.log(`서버가 ${port}번 포트에서 실행중입니다.`);
});
async function chaining(plan) {
  const ai = new GoogleGenAI({}); // GEMINI_API_KEY 알아서 인식해줌
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
    [장소] ${plan.destination}
    [목적] ${plan.purpose}
    [인원수] ${plan.people_count}
    [시작일] ${plan.start_date}
    [종료일] ${plan.end_date}`,
    config: {
      // 형식을 구조화
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
          },
        },
        required: ["prompt"],
      },
      systemInstruction: [
        // { text: "제공받은 정보를 바탕으로 여행 계획을 짜되, 300자 이내로." },
        {
          text: `제공받은 정보를 바탕으로 최적의 여행 계획을 세우기 위한 프롬프트를 작성해줘. 응답은 JSON 형식으로 {"prompt": "프롬프트 내용"} 형식으로 작성해줘.`,
        },
      ],
      // structured output
    },
  });
  const { prompt } = JSON.parse(response.text);
  console.log("prompt", prompt);
  const response2 = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite", // 모델을 상대적으로 약한 모델로...
    contents: prompt,
    config: {
      systemInstruction: [
        {
          text: "프롬프트에 따라 작성하되, 300자 이내 plain text(no markdown or rich text)로.",
        },
      ],
    },
  });
  return response2.text;
}
async function ensemble(result) {
  const groq = new Groq(); // api key -> GROQ_API_KEY -> 환경변수가 알아서 인식
  const models = [
    "moonshotai/kimi-k2-instruct-0905",
    "openai/gpt-oss-120b",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
  ];
  const responses = await Promise.all(
    models.map(async (model) => {
      // https://console.groq.com/docs/structured-outputs
      const response = await groq.chat.completions.create({
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: `여행 경비 산출 전문가로, 주어진 여행 계획을 바탕으로 '원화 기준'의 숫자로만 작성된 예산을 작성하기. 응답은 JSON 형식으로 {"min_budget":"최소 예산", "max_budget": "최대 예산"}`,
          },
          {
            role: "user",
            content: result,
          },
        ],
        model,
      });
      console.log(response.choices[0].message.content);
      const { min_budget, max_budget } = JSON.parse(
        response.choices[0].message.content
      );
      return {
        min_budget: Number(min_budget),
        max_budget: Number(max_budget),
      };
    })
  );
  console.log(responses);
  return {
    minBudget: Math.min(...responses.map((v) => v.min_budget)),
    maxBudget: Math.max(...responses.map((v) => v.max_budget)),
  };
}
