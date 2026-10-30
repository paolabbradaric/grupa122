const auditionModel = require('../models/auditionModels');

async function getAuditionSlots(req, res) {
    try{
        const casting_call_id = Number(req.params.casting_call_id);

        if(!Number.isInteger(casting_call_id) || casting_call_id <= 0){
            return res.status(400).json({
               error: "Neispravan id oglasa."
            });
        }

        const termini = await auditionModel.getAuditionSlots(casting_call_id);

        res.json(termini);
    }catch(error){
        console.error('Greška pri dohvaćanju termina', error);

        res.status(500).json({
            error: 'Nije moguće dohvatiti termine audicija.'
        });
    }
}

async function createAuditionSlot(req, res) {
    try{
        const casting_call_id = Number(req.params.casting_call_id);
        const{starts_at, ends_at, location, capacity} = req.body;

        if(!Number.isInteger(casting_call_id) || casting_call_id <=0){
            return res.status(400).json({
                error: "Neispravan id oglasa."
            });
        }
        const pocetak = new Date(starts_at);
        const kraj = new Date(ends_at);
        const brojMjesta = Number(capacity);

        if(!starts_at || !ends_at || Number.isNaN(pocetak.getTime()) || Number.isNaN(kraj.getTime()) || kraj<=pocetak){
            return res.status(400).json({
                error: "Neispravan početak i završetak termina."
            });
        }

        if(typeof location!== String || location.trim() === "" || !Number.isInteger(brojMjesta) || brojMjesta<=0){
            return res.status(400).json({
                error: "Neispravan unos."
            });
        }

        const termin = await auditionModel.createAuditionSlot(
            casting_call_id, pocetak.toISOString(), kraj.toISOString(), location.trim(), brojMjesta
        );

        res.status(201).json(termin);
    } catch(error){
        console.error("Greška pri dodavanju termina.", error);

        res.status(500).json({
            error: "Nije moguće dodati termin audicije."
        });
    }
}

module.exports = {
    getAuditionSlots,
    createAuditionSlot
};