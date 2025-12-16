import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Users,
  Monitor,
  Eye,
} from "lucide-react";
import "./index.css";
import { socket } from "./socket";

// ✅ IMPORTA TUS SLIDES (ya los tienes en src/assets/genibot/)
import s1 from "./assets/genibot/1.png";
import s2 from "./assets/genibot/2.png";
import s3 from "./assets/genibot/3.png";
import s4 from "./assets/genibot/4.png";
import s5 from "./assets/genibot/5.png";
import s6 from "./assets/genibot/6.png";
import s7 from "./assets/genibot/7.png";
import s8 from "./assets/genibot/8.png";
import s9 from "./assets/genibot/9.png";
import s10 from "./assets/genibot/10.png";
import s11 from "./assets/genibot/11.png";



const DEFAULT_SESSION_ID = "demo-session";

const InteractivePresentation = () => {
  // ─────────────────────────────────────────────────────────────
  // Estado UI
  // ─────────────────────────────────────────────────────────────
  const [userType, setUserType] = useState(null); // 'presenter' | 'participant'
  const [participantName, setParticipantName] = useState("");
  const [participantNameInput, setParticipantNameInput] = useState("");

  // ✅ Session ID editable (opcional)
  const [sessionId] = useState(DEFAULT_SESSION_ID);

  // Estado sincronizado por backend
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quizActive, setQuizActive] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Participantes y respuestas (desde backend)
  const [participants, setParticipants] = useState([]);
  const [participantAnswers, setParticipantAnswers] = useState({}); // { participantId: { name, answers } }

  // Respuestas propias (participante)
  const [myAnswers, setMyAnswers] = useState({});

  // Identidad del participante (asignada por backend)
  const [participantId, setParticipantId] = useState(() => {
    // persistimos para que al recargar no pierda su id
    return localStorage.getItem(`${DEFAULT_SESSION_ID}-pid`) || "";
  });

  const joinedRef = useRef(false);

  // ✅ Slides desde Canva (imágenes)
  const slides = useMemo(
    () => [
      { title: "Slide 1", imageSrc: s1, alt: "Genibot - Slide 1" },
      { title: "Slide 2", imageSrc: s2, alt: "Genibot - Slide 2" },
      { title: "Slide 3", imageSrc: s3, alt: "Genibot - Slide 3" },
      { title: "Slide 4", imageSrc: s4, alt: "Genibot - Slide 4" },
      { title: "Slide 5", imageSrc: s5, alt: "Genibot - Slide 5" },
      { title: "Slide 6", imageSrc: s6, alt: "Genibot - Slide 6" },
      { title: "Slide 7", imageSrc: s7, alt: "Genibot - Slide 7" },
      { title: "Slide 8", imageSrc: s8, alt: "Genibot - Slide 8" },
      { title: "Slide 9", imageSrc: s9, alt: "Genibot - Slide 9" },
      { title: "Slide 10", imageSrc: s10, alt: "Genibot - Slide 10" },
      { title: "Slide 11", imageSrc: s11, alt: "Genibot - Slide 11" },
    ],
    []
  );

  // ✅ Quiz
  const quizQuestions = useMemo(
    () => [
      {
        id: 1,
        question: "¿Qué tipo de luz utiliza el sensor HW-201?",
        options: ["Luz UV", "Luz infrarroja (IR)", "Luz visible", "Luz láser"],
        correct: 1,
      },
      {
        id: 2,
        question: "¿Cómo detecta un obstáculo el sensor infrarrojo?",
        options: [
          "Por temperatura",
          "Por sonido",
          "Por el rebote de la luz IR",
          "Por vibración",
        ],
        correct: 2,
      },
      {
        id: 3,
        question: "¿A qué pin se conecta la señal OUT del sensor en Genibot?",
        options: ["P2", "P3", "P4 (AIN)", "P5 (GND)"],
        correct: 2,
      },
      {
        id: 4,
        question: "¿Qué hace Genibot en Scratch con el valor leído en AIN?",
        options: [
          "Lo ignora",
          "Lo compara con un umbral para decidir acciones",
          "Lo convierte en sonido automáticamente",
          "Lo envía por Bluetooth siempre",
        ],
        correct: 1,
      },
    ],
    []
  );

  // ✅ Pre-carga de imágenes (evita parpadeo)
  useEffect(() => {
    slides.forEach((s) => {
      const img = new Image();
      img.src = s.imageSrc;
    });
  }, [slides]);

  // ─────────────────────────────────────────────────────────────
  // SOCKET: conectar, unirse y escuchar updates
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userType) return; // todavía no eligió rol

    // Participante necesita nombre antes de unirse
    if (userType === "participant" && !participantName) return;

    // Evitar doble-join
    if (joinedRef.current) return;
    joinedRef.current = true;

    // Conecta socket
    if (!socket.connected) socket.connect();

    // Listeners
    const onStateUpdate = (s) => {
      if (!s) return;
      if (typeof s.currentSlide === "number") setCurrentSlide(s.currentSlide);
      setQuizActive(!!s.quizActive);
      setShowResults(!!s.showResults);
    };

    const onAnswersUpdate = (a) => {
      // Backend manda: { participantId: { name, answers, updatedAt }, ... }
      setParticipantAnswers(a || {});
    };

    const onParticipantsUpdate = (p) => {
      setParticipants(Array.isArray(p) ? p : []);
    };

    const onSessionReset = () => {
      // reset suave
      setCurrentSlide(0);
      setQuizActive(false);
      setShowResults(false);
      setParticipantAnswers({});
      setParticipants([]);
      setMyAnswers({});
      // Si quieres volver al inicio total:
      setUserType(null);
      setParticipantName("");
      setParticipantNameInput("");
      // participantId se mantiene (no lo borramos), pero puedes borrarlo si prefieres:
      // setParticipantId("");
      // localStorage.removeItem(`${DEFAULT_SESSION_ID}-pid`);
      joinedRef.current = false;
    };

    socket.on("state:update", onStateUpdate);
    socket.on("answers:update", onAnswersUpdate);
    socket.on("participants:update", onParticipantsUpdate);
    socket.on("session:reset", onSessionReset);

    // Join
    socket.emit(
      "session:join",
      {
        sessionId,
        role: userType,
        name: userType === "participant" ? participantName : undefined,
      },
      (ack) => {
        if (ack?.ok && ack?.participantId) {
          setParticipantId(ack.participantId);
          localStorage.setItem(`${DEFAULT_SESSION_ID}-pid`, ack.participantId);
        }
        if (ack?.state) onStateUpdate(ack.state);
      }
    );

    return () => {
      socket.off("state:update", onStateUpdate);
      socket.off("answers:update", onAnswersUpdate);
      socket.off("participants:update", onParticipantsUpdate);
      socket.off("session:reset", onSessionReset);
      // No desconectamos para no romper hot reload, pero si quieres:
      // socket.disconnect();
      joinedRef.current = false;
    };
  }, [userType, participantName, sessionId]);

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  const calculateParticipantScore = (answersObj) => {
    let correct = 0;
    quizQuestions.forEach((q) => {
      if (answersObj?.[q.id] === q.correct) correct++;
    });
    return correct;
  };

  // ─────────────────────────────────────────────────────────────
  // Acciones del Presentador (emiten al backend)
  // ─────────────────────────────────────────────────────────────
  const handlePresenterSlideChange = (direction) => {
    const next =
      direction === "next"
        ? Math.min(currentSlide + 1, slides.length - 1)
        : Math.max(currentSlide - 1, 0);

    socket.emit("state:set", {
      sessionId,
      patch: { currentSlide: next },
    });
  };

  const setSlideDirect = (idx) => {
    const safe = Math.max(0, Math.min(idx, slides.length - 1));
    socket.emit("state:set", {
      sessionId,
      patch: { currentSlide: safe },
    });
  };

  const handleStartQuiz = () => {
    socket.emit("quiz:start", { sessionId });
  };

  const handleShowResults = () => {
    socket.emit("quiz:showResults", { sessionId });
  };

  const handleBackToPresentation = () => {
    socket.emit("quiz:backToSlides", { sessionId });
  };

  const resetSession = () => {
    socket.emit("session:reset", { sessionId });
  };

  // ─────────────────────────────────────────────────────────────
  // Acciones del Participante
  // ─────────────────────────────────────────────────────────────
  const sendMyAnswersToServer = (nextAnswers) => {
    if (!participantId) return;
    socket.emit("answers:set", {
      sessionId,
      participantId,
      name: participantName,
      answers: nextAnswers,
    });
  };

  const handleParticipantAnswer = (questionId, optionIndex) => {
    if (showResults) return;

    const next = { ...myAnswers, [questionId]: optionIndex };
    setMyAnswers(next);
    sendMyAnswersToServer(next);
  };

  // Cuando el participante entra, manda estado inicial (vacío) para aparecer
  useEffect(() => {
    if (userType !== "participant") return;
    if (!participantName) return;
    if (!participantId) return;

    // Envía un "ping" con respuestas actuales para que aparezca en vivo
    sendMyAnswersToServer(myAnswers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, userType, participantName]);

  // ─────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────

  // Pantalla selección rol
  if (!userType) {
    return (
      <div className="ip-screen ip-screen--blue">
        <div className="ip-start-container">
          <div className="ip-start-header">
            <h1 className="ip-title">Presentación Interactiva</h1>
            <p className="ip-subtitle">Selecciona tu rol para comenzar</p>
          </div>

          <div className="ip-role-grid">
            <div
              onClick={() => setUserType("presenter")}
              className="ip-role-card ip-role-card--presenter"
              role="button"
              tabIndex={0}
            >
              <div className="ip-role-card-content">
                <div className="ip-role-icon ip-role-icon--blue">
                  <Monitor size={32} />
                </div>
                <h3 className="ip-role-title">Presentador</h3>
                <p className="ip-role-text">
                  Controla la presentación y ve las respuestas de todos
                </p>
              </div>
            </div>

            <div
              onClick={() => setUserType("participant")}
              className="ip-role-card ip-role-card--participant"
              role="button"
              tabIndex={0}
            >
              <div className="ip-role-card-content">
                <div className="ip-role-icon ip-role-icon--green">
                  <Users size={32} />
                </div>
                <h3 className="ip-role-title">Participante</h3>
                <p className="ip-role-text">
                  Sigue la presentación y responde el quiz
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla nombre participante
  if (userType === "participant" && !participantName) {
    const handleJoin = () => {
      const name = participantNameInput.trim();
      if (!name) return;
      setParticipantName(name);
      // permite que el useEffect haga el join
      joinedRef.current = false;
    };

    return (
      <div className="ip-screen ip-screen--green">
        <div className="ip-card ip-card--centered">
          <h2 className="ip-card-title">Únete como Participante</h2>
          <p className="ip-card-text">Ingresa tu nombre para comenzar</p>

          <input
            type="text"
            placeholder="Tu nombre"
            className="ip-input"
            value={participantNameInput}
            onChange={(e) => setParticipantNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />

          <button onClick={handleJoin} className="ip-button ip-button--primary">
            Entrar
          </button>

          <button
            onClick={() => {
              setUserType(null);
              joinedRef.current = false;
            }}
            className="ip-button ip-button--ghost"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VISTA PRESENTADOR
  // ─────────────────────────────────────────────────────────────
  if (userType === "presenter") {
    const participantCount = participants.length;

    return (
      <div className="ip-screen ip-screen--gray">
        <div className="ip-layout">
          <div className="ip-header">
            <div className="ip-header-left">
              <Monitor className="ip-header-icon ip-header-icon--blue" />
              <span className="ip-header-title">Modo Presentador</span>
            </div>
            <div className="ip-header-right">
              <div className="ip-participants-count">
                <Users size={20} className="ip-header-icon" />
                <span>{participantCount} participantes</span>
              </div>
              <button onClick={resetSession} className="ip-link ip-link--danger">
                Reiniciar sesión
              </button>
            </div>
          </div>

          <div className="ip-main-grid">
            {/* Panel principal */}
            <div className="ip-main-panel">
              {!quizActive ? (
                <div className="ip-slide-card">
                  <div className="ip-slide-header ip-slide-header--image">
                    <div className="ip-slide-header-top">
                      <span className="ip-slide-counter">
                        Diapositiva {currentSlide + 1} de {slides.length}
                      </span>
                    </div>
                  </div>

                  <div className="ip-slide-body ip-slide-body--image">
                    <img
                      src={slides[currentSlide].imageSrc}
                      alt={slides[currentSlide].alt || slides[currentSlide].title}
                      className="ip-slide-image"
                      draggable="false"
                    />
                  </div>

                  <div className="ip-slide-controls">
                    <button
                      onClick={() => handlePresenterSlideChange("prev")}
                      disabled={currentSlide === 0}
                      className="ip-button ip-button--secondary"
                    >
                      <ChevronLeft size={20} />
                      <span>Anterior</span>
                    </button>

                    <div className="ip-slide-dots">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSlideDirect(idx)}
                          className={
                            "ip-dot " + (idx === currentSlide ? "ip-dot--active" : "")
                          }
                          aria-label={`Ir a diapositiva ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => handlePresenterSlideChange("next")}
                      disabled={currentSlide === slides.length - 1}
                      className="ip-button ip-button--primary"
                    >
                      <span>Siguiente</span>
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <div className="ip-slide-footer">
                    <button
                      onClick={handleStartQuiz}
                      className="ip-button ip-button--success ip-button--full"
                    >
                      Activar Quiz
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ip-card">
                  <div className="ip-card-header">
                    <h2 className="ip-card-title">Quiz Activo</h2>
                    <div className="ip-card-actions">
                      {!showResults && (
                        <button
                          onClick={handleShowResults}
                          className="ip-button ip-button--primary"
                        >
                          Mostrar Resultados
                        </button>
                      )}
                      <button
                        onClick={handleBackToPresentation}
                        className="ip-button ip-button--secondary"
                      >
                        Volver a Slides
                      </button>
                    </div>
                  </div>

                  <div className="ip-quiz-questions">
                    {quizQuestions.map((q) => (
                      <div key={q.id} className="ip-quiz-question-card">
                        <h3 className="ip-quiz-question-title">
                          {q.id}. {q.question}
                        </h3>
                        <div className="ip-quiz-options">
                          {q.options.map((option, idx) => (
                            <div
                              key={idx}
                              className={
                                "ip-quiz-option " +
                                (showResults && idx === q.correct
                                  ? "ip-quiz-option--correct"
                                  : "")
                              }
                            >
                              {option}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Panel lateral */}
            <div className="ip-side-panel">
              <div className="ip-card ip-card--sticky">
                <h3 className="ip-side-title">
                  <Eye size={24} />
                  <span>Respuestas en Vivo</span>
                </h3>

                {quizActive ? (
                  <div className="ip-live-answers">
                    {Object.keys(participantAnswers).length === 0 ? (
                      <p className="ip-empty-state">Esperando respuestas...</p>
                    ) : (
                      Object.entries(participantAnswers).map(([pid, payload]) => {
                        const answers = payload?.answers || {};
                        const name = payload?.name || pid;

                        return (
                          <div key={pid} className="ip-participant-card">
                            <div className="ip-participant-card-header">
                              <span className="ip-participant-name">{name}</span>
                              {showResults && (
                                <span className="ip-participant-score">
                                  {calculateParticipantScore(answers)}/{quizQuestions.length}
                                </span>
                              )}
                            </div>

                            <div className="ip-participant-answers">
                              {quizQuestions.map((q) => (
                                <div
                                  key={q.id}
                                  className={
                                    "ip-answer-badge " +
                                    (answers[q.id] !== undefined
                                      ? showResults
                                        ? answers[q.id] === q.correct
                                          ? "ip-answer-badge--correct"
                                          : "ip-answer-badge--incorrect"
                                        : "ip-answer-badge--answered"
                                      : "ip-answer-badge--empty")
                                  }
                                >
                                  {answers[q.id] !== undefined ? q.id : "-"}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <p className="ip-empty-state">Quiz no activo</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VISTA PARTICIPANTE
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="ip-screen ip-screen--green">
      <div className="ip-layout ip-layout--narrow">
        <div className="ip-header">
          <div className="ip-header-left">
            <Users className="ip-header-icon ip-header-icon--green" />
            <span className="ip-header-title">{participantName}</span>
          </div>
          <button
            onClick={() => {
              // salir limpia UI
              setParticipantName("");
              setParticipantNameInput("");
              setUserType(null);
              setMyAnswers({});
              joinedRef.current = false;
            }}
            className="ip-link"
          >
            Salir
          </button>
        </div>

        {!quizActive ? (
          <div className="ip-slide-card">
            <div className="ip-slide-header ip-slide-header--image">
              <span className="ip-slide-counter">
                Slide {currentSlide + 1} de {slides.length}
              </span>
            </div>

            <div className="ip-slide-body ip-slide-body--image">
              <img
                src={slides[currentSlide].imageSrc}
                alt={slides[currentSlide].alt || slides[currentSlide].title}
                className="ip-slide-image"
                draggable="false"
              />
            </div>

            <div className="ip-slide-footer ip-slide-footer--muted">
              <p>El presentador controla la navegación.</p>
            </div>
          </div>
        ) : (
          <div className="ip-card">
            <h2 className="ip-card-title">Quiz</h2>

            {!showResults ? (
              <div className="ip-quiz-questions">
                {quizQuestions.map((q) => (
                  <div key={q.id} className="ip-quiz-question">
                    <h3 className="ip-quiz-question-title">
                      {q.id}. {q.question}
                    </h3>
                    <div className="ip-quiz-options">
                      {q.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleParticipantAnswer(q.id, idx)}
                          className={
                            "ip-quiz-option-button " +
                            (myAnswers[q.id] === idx
                              ? "ip-quiz-option-button--selected"
                              : "")
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(myAnswers).length === quizQuestions.length && (
                  <div className="ip-quiz-status ip-quiz-status--done">
                    <p className="ip-quiz-status-main">
                      ✓ Todas las respuestas enviadas
                    </p>
                    <p className="ip-quiz-status-sub">
                      Esperando a que el presentador muestre resultados...
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="ip-results-header">
                  <h3 className="ip-card-title">¡Resultados!</h3>
                  <p className="ip-results-score">
                    {calculateParticipantScore(myAnswers)} / {quizQuestions.length}
                  </p>
                  <p className="ip-results-subtitle">respuestas correctas</p>
                </div>

                <div className="ip-results-list">
                  {quizQuestions.map((q) => {
                    const isCorrect = myAnswers[q.id] === q.correct;
                    return (
                      <div key={q.id} className="ip-result-row">
                        <div className="ip-result-icon">
                          {isCorrect ? (
                            <Check className="ip-result-icon--correct" size={24} />
                          ) : (
                            <X className="ip-result-icon--incorrect" size={24} />
                          )}
                        </div>
                        <div className="ip-result-content">
                          <p className="ip-result-question">{q.question}</p>
                          <p
                            className={
                              "ip-result-answer " +
                              (isCorrect
                                ? "ip-result-answer--correct"
                                : "ip-result-answer--incorrect")
                            }
                          >
                            Tu respuesta: {q.options[myAnswers[q.id]] || "Sin responder"}
                          </p>
                          {!isCorrect && (
                            <p className="ip-result-correct">
                              Correcta: {q.options[q.correct]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return <InteractivePresentation />;
}

export { socket };
