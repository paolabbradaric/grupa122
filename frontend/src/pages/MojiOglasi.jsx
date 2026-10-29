//prikaz oglasa poslodavaca na stranici moji oglasi
function MojiOglasi() {
    const oglasi = [];

    return (
        <main>
            <h1>
                Moji oglasi
            </h1>

            <p>
            Ovdje možete pregledavati i 
            upravljati svojim casting oglasima.
            </p>

            {oglasi.length === 0 ? (
                <p>Trenutno nemate oglasa.</p>
            ) : (
                <div>
                    {oglasi.map((oglas) => (
                        <div key={oglas.id}>
                            <h2>{oglas.naziv}</h2>
                            <p>Status: {oglas.status}</p>
                        </div>
                    ))}
                </div>
            )}

        </main>
    )
}

export default MojiOglasi;