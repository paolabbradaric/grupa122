import { useEffect, useRef, useState } from "react";
import { moderationRequest } from "../services/moderation";

function prikaziDatum(vrijednost) {
  const datum = new Date(vrijednost);

  if (!Number.isFinite(datum.getTime())) {
    return "Datum nije dostupan";
  }

  return datum.toLocaleString("hr-HR", {
    timeZone: "Europe/Zagreb",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function aktivnaRezervacija(rezervacija) {
  return (
    rezervacija !== null &&
    !["cancelled", "canceled"].includes(rezervacija.status)
  );
}

function CandidateAuditionBooking({
  prijava,
  csrfToken,
  onBusyChange,
}) {
  const [termini, setTermini] = useState([]);
  const [rezervacija, setRezervacija] = useState(null);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [spremanje, setSpremanje] = useState(false);
  const [greskaDohvata, setGreskaDohvata] = useState("");
  const [greska, setGreska] = useState("");
  const [poruka, setPoruka] = useState("");
  const [revizija, setRevizija] = useState(0);
  const [vrijeme, setVrijeme] = useState(0);

  const zahtjevUTijeku = useRef(false);

  const prijavaId = prijava.id;
  const oglasId = prijava.castingId;

  const imaRezervaciju = aktivnaRezervacija(rezervacija);
  const blokirano =
    ucitavanje || spremanje || greskaDohvata !== "";

  useEffect(() => {
    const kontroler = new AbortController();

    async function ucitaj() {
      try {
        const [popisTermina, odgovor] = await Promise.all([
          moderationRequest(`/auditions/${oglasId}`, {
            signal: kontroler.signal,
          }),
          moderationRequest(
            `/candidate/applications/${prijavaId}/booking`,
            { signal: kontroler.signal }
          ),
        ]);

        if (
          !Array.isArray(popisTermina) ||
          !odgovor ||
          !Object.hasOwn(odgovor, "booking") ||
          (odgovor.booking !== null &&
            (!Number.isInteger(odgovor.booking.id) ||
              typeof odgovor.booking.status !== "string"))
        ) {
          throw new Error("Primljeni su neispravni podaci audicije.");
        }

        if (!kontroler.signal.aborted) {
          setTermini(popisTermina);
          setRezervacija(odgovor.booking);
          setVrijeme(Date.now());
          setGreskaDohvata("");
        }
      } catch (error) {
        if (!kontroler.signal.aborted) {
          setGreskaDohvata(
            error.message || "Podatke audicije nije moguće dohvatiti."
          );
        }
      } finally {
        if (!kontroler.signal.aborted) {
          setUcitavanje(false);
        }
      }
    }

    void ucitaj();

    return () => kontroler.abort();
  }, [oglasId, prijavaId, revizija]);

  //vrijeme se ažurira izvan renderiranja komponente
  useEffect(() => {
    const interval = setInterval(() => {
      setVrijeme(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function osvjezi() {
    setUcitavanje(true);
    setGreskaDohvata("");
    setRevizija((prethodna) => prethodna + 1);
  }

  async function promijeniRezervaciju(termin = null) {
    if (blokirano || zahtjevUTijeku.current) return;

    setGreska("");
    setPoruka("");

    if (!csrfToken) {
      setGreska("Nedostaje potvrda prijave. Osvježi stranicu.");
      return;
    }

    const sada = Date.now();

    if (
      imaRezervaciju &&
      (!Number.isFinite(Date.parse(rezervacija.startsAt)) ||
        Date.parse(rezervacija.startsAt) <= sada)
    ) {
      setGreska("Rezervaciju započetog termina nije moguće mijenjati.");
      return;
    }

    if (!termin && !imaRezervaciju) return;

    if (
      termin &&
      (termin.status !== "scheduled" ||
        !Number.isFinite(Date.parse(termin.starts_at)) ||
        Date.parse(termin.starts_at) <= sada ||
        !(termin.availablePlaces > 0))
    ) {
      setGreska("Termin više nije raspoloživ. Provjeri osvježene podatke.");
      osvjezi();
      return;
    }

    const pitanje = termin
      ? `${imaRezervaciju ? "Promijeniti rezervaciju na" : "Rezervirati"} termin ${prikaziDatum(termin.starts_at)}?`
      : "Želiš li otkazati rezervaciju audicije?";

    if (!window.confirm(pitanje)) return;

    zahtjevUTijeku.current = true;
    setSpremanje(true);
    onBusyChange?.(true);

    try {
      const odgovor = await moderationRequest(
        `/candidate/applications/${prijavaId}/booking`,
        {
          method: termin ? "PUT" : "DELETE",
          csrfToken,
          ...(termin ? { body: { slotId: termin.id } } : {}),
        }
      );

      if (termin) {
        if (
          !Number.isInteger(odgovor?.booking?.id) ||
          odgovor.booking.slotId !== termin.id ||
          odgovor.booking.status !== "booked"
        ) {
          throw new Error("Ishod rezervacije nije potvrđen.");
        }
      } else if (
        odgovor?.id !== rezervacija.id ||
        odgovor.status !== "cancelled"
      ) {
        throw new Error("Ishod otkazivanja nije potvrđen.");
      }

      setPoruka(
        termin
          ? "Rezervacija je spremljena."
          : "Rezervacija je otkazana."
      );
    } catch (error) {
      setGreska(
        `${error.message || "Zahtjev nije uspio."} Provjeri aktualno stanje prije ponavljanja.`
      );
    } finally {
      zahtjevUTijeku.current = false;
      setSpremanje(false);
      onBusyChange?.(false);

      //ponovno dohvatiti stanje i nakon izgubljenog odgovora
      osvjezi();
    }
  }

  const rezervacijaZapocela =
    imaRezervaciju &&
    (!Number.isFinite(Date.parse(rezervacija.startsAt)) ||
      Date.parse(rezervacija.startsAt) <= vrijeme);

  return (
    <section className="candidate-audition">
      <h3>Audicija</h3>
      <p>Pozvan/a si na audiciju. Odaberi raspoloživ termin.</p>

      <button
        type="button"
        disabled={ucitavanje || spremanje}
        onClick={osvjezi}
      >
        Osvježi termine
      </button>

      {greska && <p role="alert">{greska}</p>}
      {poruka && <p role="status">{poruka}</p>}
      {spremanje && <p role="status">Spremanje...</p>}

      {ucitavanje ? (
        <p role="status">Učitavanje termina...</p>
      ) : greskaDohvata ? (
        <p role="alert">{greskaDohvata}</p>
      ) : (
        <>
          {imaRezervaciju ? (
            <div>
              <h4>Tvoja rezervacija</h4>
              <p>Početak: {prikaziDatum(rezervacija.startsAt)}</p>
              <p>Završetak: {prikaziDatum(rezervacija.endsAt)}</p>
              <p>Lokacija: {rezervacija.location}</p>

              <button
                type="button"
                disabled={blokirano || rezervacijaZapocela}
                onClick={() => promijeniRezervaciju()}
              >
                Otkaži rezervaciju
              </button>

              {rezervacijaZapocela && (
                <p>Termin više nije moguće mijenjati.</p>
              )}
            </div>
          ) : (
            <p>Nemaš aktivnu rezervaciju audicije.</p>
          )}

          <h4>Termini audicije</h4>

          {termini.length === 0 ? (
            <p>Poslodavac još nije dodao termine.</p>
          ) : (
            termini.map((termin) => {
              const mojTermin =
                imaRezervaciju &&
                rezervacija.slotId === termin.id;

              const dostupan =
                termin.status === "scheduled" &&
                Date.parse(termin.starts_at) > vrijeme &&
                termin.availablePlaces > 0;

              return (
                <div key={termin.id}>
                  <p>
                    <strong>
                      {prikaziDatum(termin.starts_at)}
                    </strong>
                  </p>

                  <p>Završetak: {prikaziDatum(termin.ends_at)}</p>
                  <p>Lokacija: {termin.location}</p>
                  <p>Slobodnih mjesta: {termin.availablePlaces}</p>

                  {mojTermin ? (
                    <p>Ovo je tvoj rezervirani termin.</p>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        blokirano ||
                        !dostupan ||
                        rezervacijaZapocela
                      }
                      onClick={() => promijeniRezervaciju(termin)}
                    >
                      {!dostupan
                        ? "Termin nije dostupan"
                        : imaRezervaciju
                          ? "Promijeni na ovaj termin"
                          : "Rezerviraj termin"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </section>
  );
}

export default CandidateAuditionBooking;