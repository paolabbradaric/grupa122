const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    getAuditionSlots,
    createAuditionSlot,
    cancelAuditionSlot
} = require('../src/models/auditionModels');
const { release } = require('node:os');
const { connect } = require('node:http2');
const { query } = require('../src/routes/castingRoutes');

function mockDb(rows = []){
    const calls = [];

    return{
        calls,
        async query(sql, params){
            calls.push({ sql, params });
            return{ rows };
        }
    };
}

test('dohvat termina za određeni oglas', async () => {
    const termini = [
        { id: 1, status: 'scheduled', capacity: 5 },
        { id:2, status: 'scheduled', capacity: 3 }
    ];

    const db = mockDb(termini);

    const result = await getAuditionSlots(10, db);

    assert.deepEqual(result, termini);
    assert.deepEqual(db.calls[0].params, [10]);
    assert.match(db.calls[0].sql, /WHERE casting_call_id = \$1/);
});

test('poslodavac može stvoriti termin za svoj objavljeni oglas', async() => {
    const termin = {
        id: 7,
        status: 'scheduled',
        capacity: 5
    };

    const db = mockDb([termin]);

    const result = await createAuditionSlot(
        10,
        '2026-11-15T10:00:00Z',
        '2026-11-15T11:00:00Z',
        'Zagreb',
        5,
        4,
        db
    );

    assert.deepEqual(result, termin);
    assert.deepEqual(db.calls[0].params, [
        10,
        '2026-11-15T10:00:00Z',
        '2026-11-15T11:00:00Z',
        'Zagreb',
        5,
        4
    ]);

    assert.match(db.calls[0].sql, /o\.owner_id = \$6/);
    assert.match(db.calls[0].sql, /c\.status = 'published'/);
});

test('ne stvara termin ako oglas ne pripada poslodavcu ili nije objavljen', async()=> {
    const db = mockDb([]);

    const result = await createAuditionSlot(
        10,
        '2026-11-15T10:00:00Z',
        '2026-11-15T11:00:00Z',
        'Zagreb',
        5,
        4,
        db
    );

    assert.equal(result, null);
});

test('poslodavac može otkazati budući termin bez rezervacija', async() => {
    const queries = [];

    const db = {
        async connect(){
            return {
                async query(sql, params){
                    queries.push({ sql, params });

                    if(sql.includes('FROM audition_slots s')){
                        return {
                            rows: [{
                                id: 7,
                                status: 'scheduled',
                                starts_at: '2099-11-15T10:00:00Z'
                            }]
                        };
                    }
                    if (sql.includes( 'AS has_active_bookings')){
                        return {
                            rows: [{ has_active_bookings: false}]
                        };
                    }

                    return { rows: [] };
                },
                release(){}
            };
        }
    };

    const result = await cancelAuditionSlot(10, 7, 4, db);

    assert.deepEqual(result, {
        outcome: 'cancelled',
        id: 7
    });

    const selectQuery = queries.find(q =>
        q.sql.includes('FROM audition_slots s')
    );

    assert.ok(selectQuery);
    assert.match(selectQuery.sql, /JOIN casting_calls c/);
    assert.match(selectQuery.sql, /WHERE s\.id = \$1/);
    assert.match(selectQuery.sql, /FOR UPDATE OF s/);

    assert.ok(
        queries.some(q =>
            q.sql.includes("SET status = 'cancelled'")
        )
    );

    assert.ok(
        queries.some(q => q.sql === 'COMMIT')
    );
});

test('poslodavac ne može otkazati tuđi ili nepostojeći termin', async() => {
    const queries = [];

    const db = {
        async connect(){
            return {
                async query(sql){
                    queries.push(sql);

                    if(sql.includes('FROM audition_slots s')){
                        return { rows: [] };
                    }

                    return { rows: [] };
                },
                release(){}
            };
        }
    };

    const result = await cancelAuditionSlot(10, 7, 4, db);

    assert.deepEqual(result, { outcome: 'not_found'});
    assert.ok(queries.includes('ROLLBACK'));
    assert.ok(!queries.some(sql => sql.includes('UPDATE audition_slots')));
    assert.ok(!queries.includes('COMMIT'));
});

test('poslodavac ne može otkazati termin s aktivnim rezervacijama', async()=> {
    const queries = [];

    const db ={
        async connect(){
            return{
                async query(sql){
                    queries.push(sql);

                    if(sql.includes('FROM audition_slots s')){
                        return{
                            rows: [{
                                id: 7,
                                status: 'scheduled',
                                starts_at: '2099-11-15T10:00:00Z'
                            }]
                        };
                    }
                    if(sql.includes('AS has_active_bookings')){
                        return { rows: [{ has_active_bookings: true }]};
                    }
                    return { rows: [] };
                },
                release() {}
            };
        }
    };

    const result = await cancelAuditionSlot(10,7,4,db);

    assert.deepEqual(result, { outcome: 'active_bookings'});
    assert.ok(queries.includes('ROLLBACK'));
    assert.ok(!queries.some(sql => sql.includes('UPDATE audition_slots')));
    assert.ok(!queries.includes('COMMIT'));
});