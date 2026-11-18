import { useEffect, useRef, useState } from "react";
import { profileRequest } from "../services/profiles";
import ChangePassword from "./ChangePassword";
import VerificationRequest from "./VerificationRequest";
import "./ProfileEditor.css";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_PORTFOLIO_IMAGES = 5;

const candidateFields = [
  ["firstName", "Ime", "text", 100, true],
  ["lastName", "Prezime", "text", 100, true],
  ["birthDate", "Datum rođenja", "date", 10, true],
  ["city", "Grad", "text", 100],
  ["experience", "Iskustvo i vještine", "textarea", 5000],
  ["heightCm", "Visina (cm)", "number"],
  ["weightKg", "Težina (kg)", "number"],
  ["eyeColor", "Boja očiju", "select"],
  ["hairColor", "Boja kose", "select"],
];

const employerFields = [
  ["companyName", "Naziv tvrtke", "text", 200, true],
  ["regNum", "OIB", "text", 11, true],
  ["contactEmail", "Kontaktni e-mail", "email", 255, true],
  ["phone", "Broj telefona", "tel", 30, true],
  ["location", "Sjedište tvrtke", "text", 255, true],
];

function checkImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const pixels = image.naturalWidth * image.naturalHeight;
      URL.revokeObjectURL(url);

      if (pixels > MAX_IMAGE_PIXELS) {
        reject(
          new Error(
            `Slika "${file.name}" ima preveliku rezoluciju. Dopušteno je najviše 20 milijuna piksela.`,
          ),
        );
      } else {
        resolve();
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Slika "${file.name}" nije ispravna ili je nije moguće otvoriti.`,
        ),
      );
    };

    image.src = url;
  });
}

async function validateFiles(files, existingCount, multiple) {
  if (!files.length) {
    throw new Error("Odaberi barem jednu sliku.");
  }

  if (multiple && existingCount + files.length > MAX_PORTFOLIO_IMAGES) {
    throw new Error("Portfolio može sadržavati najviše 5 slika.");
  }

  for (const file of files) {
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      throw new Error(`Datoteka "${file.name}" nije JPG ili PNG slika.`);
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`Slika "${file.name}" prelazi zadanu granicu od 5 MB.`);
    }

    if (file.size === 0) {
      throw new Error(`Datoteka "${file.name}" je prazna.`);
    }

    await checkImageDimensions(file);
  }
}

function ImageControl({ purpose, label, media = [], busy, run }) {
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [validating, setValidating] = useState(false);
  const input = useRef(null);

  const multiple = purpose === "portfolio";
  const total = media.length + files.length;

  async function selectFiles(event) {
    const selected = Array.from(event.target.files || []);

    setFileError("");
    setFiles([]);
    setValidating(true);

    try {
      await validateFiles(selected, media.length, multiple);

      setFiles(selected);
    } catch (error) {
      setFileError(error.message);
      event.target.value = "";
    } finally {
      setValidating(false);
    }
  }

  async function upload() {
    if (busy || validating || !files.length) return;

    setFileError("");

    try {
      await validateFiles(files, media.length, multiple);

      const form = new FormData();

      files.forEach((file) => {
        form.append(multiple ? "files" : "file", file);
      });

      const success = await run(
        `/${purpose}`,
        {
          method: multiple ? "POST" : "PUT",
          body: form,
        },
        "Slike su spremljene.",
      );

      if (success) {
        setFiles([]);
        if (input.current) {
          input.current.value = "";
        }
      }
    } catch (error) {
      setFileError(error.message);
    }
  }

  return (
    <section aria-label={label}>
      <h2>{label}</h2>

      {multiple && (
        <p>
          Ukupno slika: {total}/{MAX_PORTFOLIO_IMAGES}
        </p>
      )}

      <p>
        Dopušteni formati: JPG i PNG. Zadana maksimalna veličina: 5 MB po slici.
        Najviše 20 milijuna piksela.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {media.map((image) => (
          <div key={image.id}>
            <img
              src={image.contentUrl}
              alt={image.name || label}
              width="150"
              style={{
                maxWidth: "100%",
                height: "auto",
              }}
            />

            <p>{image.name}</p>

            <button
              type="button"
              disabled={busy || validating}
              onClick={() =>
                run(
                  `/${purpose}${multiple ? `/${image.id}` : ""}`,
                  { method: "DELETE" },
                  "Slika je uklonjena.",
                )
              }
            >
              Ukloni sliku
            </button>
          </div>
        ))}
      </div>

      <label>
        Odaberi {multiple ? "nove slike" : "novu sliku"} (JPG ili PNG)
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          multiple={multiple}
          disabled={
            busy ||
            validating ||
            (multiple && media.length >= MAX_PORTFOLIO_IMAGES)
          }
          onChange={selectFiles}
        />
      </label>

      {validating && <p role="status">Provjeravam slike…</p>}

      {fileError && <p role="alert">{fileError}</p>}

      {files.length > 0 && (
        <p>Za upload: {files.map((file) => file.name).join(", ")}</p>
      )}

      <button
        type="button"
        disabled={
          busy ||
          validating ||
          !files.length ||
          (multiple && total > MAX_PORTFOLIO_IMAGES)
        }
        onClick={upload}
      >
        {multiple ? "Dodaj slike" : "Spremi sliku"}
      </button>
    </section>
  );
}

export default function ProfileEditor({
  user,
  role,
  csrfToken,
  onUserUpdated,
}) {
  const [data, setData] = useState(null);
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [security, setSecurity] = useState(false);

  const active = useRef(false);

  const definitions = role === "candidate" ? candidateFields : employerFields;

  useEffect(() => {
    active.current = true;

    const controller = new AbortController();

    profileRequest("", {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;

        setData(result.profile);

        setFields(
          Object.fromEntries(
            definitions.map(([key]) => [key, result.profile[key] ?? ""]),
          ),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      });

    return () => {
      active.current = false;
      controller.abort();
    };
  }, [user.id, role]);

  async function run(path, options, success) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await profileRequest(path, {
        ...options,
        csrfToken,
      });

      if (!active.current) return false;

      setData(result.profile);
      onUserUpdated(result.user);
      setMessage(success);

      return true;
    } catch (error) {
      if (active.current) {
        setError(error.message);
      }

      return false;
    } finally {
      if (active.current) {
        setBusy(false);
      }
    }
  }

  async function save(event) {
    event.preventDefault();

    if (busy) return;

    const body = { ...fields };

    for (const key of ["heightCm", "weightKg"]) {
      if (key in body) {
        body[key] = body[key] === "" ? null : Number(body[key]);
      }
    }

    await run(
      "",
      {
        method: "PATCH",
        body,
      },
      "Podaci profila su spremljeni. Slike se spremaju zasebno.",
    );
  }

  return (
    <main className="profile-editor">
      <h1>Moj profil — {role === "candidate" ? "kandidat" : "poslodavac"}</h1>

      {error && <p role="alert">{error}</p>}

      {message && <p role="status">{message}</p>}

      {!data ? (
        <p role="status">
          {error
            ? "Profil nije učitan. Osvježi stranicu za ponovni pokušaj."
            : "Učitavam profil…"}
        </p>
      ) : (
        <>
          <form onSubmit={save}>
            <fieldset
              disabled={busy}
              style={{
                border: 0,
                padding: 0,
                minWidth: 0,
              }}
            >
              {definitions.map(([key, label, type, maxLength, required]) => {
                const props = {
                  id: key,
                  name: key,
                  value: fields[key] ?? "",
                  required,
                  maxLength,
                  onChange: (event) =>
                    setFields((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    })),
                };

                return (
                  <div key={key}>
                    <label htmlFor={key}>{label}</label>

                    {type === "textarea" ? (
                      <textarea {...props} />
                    ) : type === "select" ? (
                      <select {...props}>
                        <option value="">Odaberi</option>

                        {(key === "eyeColor"
                          ? ["smeđa", "plava", "zelena", "siva", "ostalo"]
                          : [
                              "smeđa",
                              "plava",
                              "crna",
                              "crvena",
                              "sijeda",
                              "ostalo",
                            ]
                        ).map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...props}
                        type={type}
                        min={type === "number" ? "0.01" : undefined}
                        step={
                          key === "weightKg"
                            ? "0.01"
                            : type === "number"
                              ? "1"
                              : undefined
                        }
                      />
                    )}
                  </div>
                );
              })}

              <button type="submit">
                {busy ? "Spremam…" : "Spremi promjene"}
              </button>
            </fieldset>
          </form>

          <p>
            Podatke i slike spremi zasebno. Neuspješan upload ne poništava
            spremljene podatke.
          </p>

          {role === "candidate" ? (
            <>
              <ImageControl
                purpose="avatar"
                label="Profilna fotografija"
                media={data.avatar ? [data.avatar] : []}
                busy={busy}
                run={run}
              />

              <ImageControl
                purpose="portfolio"
                label="Portfolio"
                media={data.portfolio || []}
                busy={busy}
                run={run}
              />
            </>
          ) : (
            <>
              <ImageControl
                purpose="logo"
                label="Logo tvrtke"
                media={data.logo ? [data.logo] : []}
                busy={busy}
                run={run}
              />

              <VerificationRequest csrfToken={csrfToken} />
            </>
          )}
        </>
      )}

      <button type="button" onClick={() => setSecurity(!security)}>
        Sigurnost Google računa
      </button>

      {security && <ChangePassword onZatvori={() => setSecurity(false)} />}
    </main>
  );
}
