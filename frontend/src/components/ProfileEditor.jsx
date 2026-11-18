import { useEffect, useRef, useState } from "react";
import { profileRequest } from "../services/profiles";
import ChangePassword from "./ChangePassword";
import VerificationRequest from "./VerificationRequest";

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
function ImageControl({ purpose, label, media, busy, run }) {
  const [files, setFiles] = useState([]);
  const input = useRef(null);
  const multiple = purpose === "portfolio";
  async function upload() {
    const form = new FormData();
    files.forEach((file) => form.append(multiple ? "files" : "file", file));
    if (
      await run(
        `/${purpose}`,
        { method: multiple ? "POST" : "PUT", body: form },
        "Slike su spremljene.",
      )
    ) {
      setFiles([]);
      input.current.value = "";
    }
  }
  return (
    <section aria-label={label}>
      <h2>{label}</h2>
      {multiple && <p>Ukupno slika: {media.length + files.length}/5</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {media.map((image) => (
          <div key={image.id}>
            <img
              src={image.contentUrl}
              alt={label}
              width="150"
              style={{ maxWidth: "100%", height: "auto" }}
            />
            <p>{image.name}</p>
            <button
              type="button"
              disabled={busy}
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
          disabled={busy}
          onChange={(event) => setFiles(Array.from(event.target.files))}
        />
      </label>
      {files.length > 0 && (
        <p>Za upload: {files.map((file) => file.name).join(", ")}</p>
      )}
      <button
        type="button"
        disabled={
          busy || !files.length || (multiple && media.length + files.length > 5)
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
    profileRequest("", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result.profile);
        setFields(
          Object.fromEntries(
            (role === "candidate" ? candidateFields : employerFields).map(
              ([key]) => [key, result.profile[key] ?? ""],
            ),
          ),
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
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
      const result = await profileRequest(path, { ...options, csrfToken });
      if (!active.current) return false;
      setData(result.profile);
      onUserUpdated(result.user);
      setMessage(success);
      return true;
    } catch (e) {
      if (active.current) setError(e.message);
      return false;
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    const body = { ...fields };
    for (const key of ["heightCm", "weightKg"])
      if (key in body) body[key] = body[key] === "" ? null : Number(body[key]);
    await run(
      "",
      { method: "PATCH", body },
      "Podaci profila su spremljeni. Slike se spremaju zasebno.",
    );
  }
  return (
    <main>
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
              style={{ border: 0, padding: 0, minWidth: 0 }}
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
                media={data.portfolio}
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
