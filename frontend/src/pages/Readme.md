NINA 27.10.2026.
    Napravila sam fileove Home.jsx i Home.css koji predstavljaju početnu stranicu kada gost prvotno otvori stranicu.
    Objekt castings predstavlja mock podatke oglasa koji će se izbrisati iz koda kada se napravi API koji će spajati bazu i prave podatke o oglasima s frontendom
    Izgled i definicija oglasa se nalazi u CastingCard fileovima u /components
    Treba dodati dio u kojem ako nema aktualnih oglasa se prikazuje odgovarajući tekst tipa "Nema aktialnih oglasa. Napravi svoj!"




NINA 11.11.2026.
    U Home.jsx sam zakomentirala mock podatke i povezala s bazom, ali kako je baza trenutno prazna, nema objavljenih oglasa pa ne mogu provjeriti tocnost.
    Dodala sam CastingCartDetails.jsx koji bi se trebao otvoriti kada se klikne na "Pogledaj detalje" (što je omogućeno u App.jsx kod page i <Home> dijela). Tamo bi se trebale prikazati informacije tipa lokacija, rok, status itd, ali također ne znam jel se ispravno prikazuje jer je prazna baza.
   