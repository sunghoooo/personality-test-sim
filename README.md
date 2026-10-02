# AI 기반 전력관리 시스템

> 2026-1학기 종합설계 팀 프로젝트를 정리한 레포지토리입니다.

![웹 대시보드](image/dashboard.png)

## 프로젝트 개요

제조공정의 15분 단위 전력 데이터를 TCN으로 예측하고, LLM(Gemini)이 위험 시점에 대한
운영 가이드를 생성하는 시스템입니다. 이 레포는 그중 **분석 모듈로부터 데이터를 수신하여
저장하고, 대시보드에 실시간 반영하는 백엔드**를 담당합니다.

- 분석 모듈(TCN 예측 + LLM 가이드 생성): 팀원 담당 — 본 레포 범위 외
- 수신 백엔드 + 실시간 대시보드: **본 레포**

## 아키텍처

```
분석 모듈 (팀원)                           백엔드 (본 레포)
TCN 예측 + LLM 가이드  ─ HTTP POST (JSON) →  POST /api/from-analyst
                                              ├─ type: record      → 저장 + WS 즉시 송출
                                              └─ type: agent_guide → timestamp 매칭 저장
                                                                      + 커밋 후 WS 알림
                                              MySQL (power_record / ai_guide)
                                              WebSocket /topic/alerts → 대시보드 (Chart.js)
```

## 기술 스택

- Java 21, Spring Boot 3.4 (Web, WebSocket/STOMP, Data JPA)
- MySQL 8, Lombok
- 프론트: 단일 HTML + Chart.js + SockJS/STOMP (백엔드 static 서빙)

## 주요 설계 결정

- **가이드는 risk_points만 시점별로 저장** — LLM의 24시간 종합 가이드에서 위험 시점
  배열만 풀어 저장. UI가 "15분 데이터마다 그 시점의 해설"만 보여주는 정책이므로
  저장 구조도 조회 패턴을 따름. 정상 시점은 row 부재 자체가 "정상" 신호.
- **ai_guide는 power_record와 PK 공유 (@MapsId)** — 1:1 관계를 스키마 수준에서 강제,
  record id만으로 가이드 조회 가능.
- **가이드 WS 알림은 트랜잭션 커밋 후 송출** — 커밋 전 송출 시 프론트의 즉시 조회가
  미커밋 데이터를 못 보는 레이스 컨디션 방지 (`TransactionSynchronization.afterCommit`).
- **N+1 방지** — 최근 기록 조회 시 record id를 모아 가이드를 IN 쿼리 한 번으로 조회.

## 실행 방법

로컬 MySQL(ems_db) 필요:

```bash
./gradlew bootRun
# http://localhost:8080 접속 → 자동으로 데모 시작 (저장된 실데이터 리플레이)
```
