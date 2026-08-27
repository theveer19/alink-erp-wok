"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Section, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/utils";
import type { Customer, SupplierFull } from "@/lib/types";

type Passenger = { name: string; mobile: string; email: string };
const emptyPax = (): Passenger => ({ name: "", mobile: "", email: "" });

export default function NewBookingClient({
  bookerName,
  customers,
}: {
  bookerName: string;
  customers: Customer[];
  suppliers: SupplierFull[]; // kept for page compatibility, not used
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // 1. Customer
  const [customerId, setCustomerId] = useState("");
  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  // 2. Booker
  const [booker, setBooker] = useState({ name: bookerName, mobile: "", email: "" });

  // 3. Passengers (name, mobile, email only)
  const [pax, setPax] = useState<Passenger[]>([emptyPax()]);
  const paxCount = Math.max(pax.filter((p) => p.name.trim()).length, 1);

  // 4. Booking For
  const [svcType, setSvcType] = useState<"" | "hotel" | "flight">("");
  const [scTouched, setScTouched] = useState(false);

  // auto service charge = customer per-pax charge × pax count
  const autoSc = useMemo(() => {
    if (!customer) return 0;
    const per =
      svcType === "hotel"
        ? Number(customer.hotel_service_charge || 0)
        : svcType === "flight"
          ? Number(customer.flight_service_charge || 0)
          : 0;
    return per * paxCount;
  }, [customer, svcType, paxCount]);

  const [hotel, setHotel] = useState({
    hotel_name: "",
    checkin: "",
    checkin_time: "14:00",
    checkout: "",
    checkout_time: "11:00",
    rate: "",
    service_charge: "",
  });
  const [flight, setFlight] = useState({
    origin: "",
    destination: "",
    flight_number: "",
    date: "",
    rate: "",
    service_charge: "",
  });

  const scValue = scTouched
    ? svcType === "hotel"
      ? hotel.service_charge
      : flight.service_charge
    : String(autoSc || "");

  const setSc = (v: string) => {
    setScTouched(true);
    if (svcType === "hotel") setHotel((h) => ({ ...h, service_charge: v }));
    else setFlight((f) => ({ ...f, service_charge: v }));
  };

  const nights = useMemo(() => {
    if (!hotel.checkin || !hotel.checkout) return "";
    const d = (new Date(hotel.checkout).getTime() - new Date(hotel.checkin).getTime()) / 86400000;
    return d > 0 ? String(Math.round(d)) : "";
  }, [hotel.checkin, hotel.checkout]);
  const days = nights ? String(Number(nights) + 1) : "";

  // The rate entered is PER PASSENGER — the booking total multiplies it by pax.
  const perPaxRate = Number((svcType === "hotel" ? hotel.rate : flight.rate) || 0);
  const rateTotal = perPaxRate * paxCount;
  const grandTotal = rateTotal + Number(scValue || 0);

  const setP = (i: number, k: keyof Passenger, v: string) =>
    setPax((arr) => arr.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));

  const goNext = () => {
    if (!customerId) return toast.error("Select a customer to continue");
    setStep(2);
  };

  const book = async () => {
    if (!customerId) return toast.error("Select a customer");
    if (!svcType) return toast.error("Choose a service (Hotel or Flight)");
    setSaving(true);
    try {
      const destination = svcType === "flight" ? `${flight.origin} → ${flight.destination}` : hotel.hotel_name;
      const travel_start = svcType === "flight" ? flight.date : hotel.checkin;
      const travel_end = svcType === "hotel" ? hotel.checkout : flight.date;
      const cleanPax = pax.filter((p) => p.name.trim());

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          customer: {},
          booked_by: booker.name,
          booker_mobile: booker.mobile,
          booker_email: booker.email,
          destination,
          travel_start_date: travel_start,
          travel_end_date: travel_end,
          num_travellers: cleanPax.length,
          passengers: cleanPax,
          status: "Booking Requested",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const booking = await res.json();

      // Rate entered is per pax; store it as a per-pax basis so every later
      // recalculation (edit dialog, invoice) multiplies by passenger count too.
      const svcPayload =
        svcType === "hotel"
          ? {
              hotel_name: hotel.hotel_name,
              checkin: hotel.checkin,
              check_in: hotel.checkin,
              checkout: hotel.checkout,
              check_out: hotel.checkout,
              check_in_time: hotel.checkin_time,
              check_out_time: hotel.checkout_time,
              nights: nights || "1",
              rooms: 1,
              rate_basis: "per_pax",
              sales_rate: perPaxRate,
              customer_rate: rateTotal,
              customer_service_charge: scValue,
            }
          : {
              flight_number: flight.flight_number,
              origin: flight.origin,
              from: flight.origin,
              destination: flight.destination,
              to: flight.destination,
              departure_date: flight.date,
              rate_basis: "per_pax",
              sales_rate: perPaxRate,
              customer_rate: rateTotal,
              customer_service_charge: scValue,
            };

      const svcRes = await fetch(`/api/bookings/${booking.id}/services/${svcType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(svcPayload),
      });
      if (!svcRes.ok) throw new Error((await svcRes.json()).error);

      toast.success(`Booking ${booking.booking_number} created`);
      router.push(`/bookings/${booking.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="New Booking"
        subtitle={
          step === 1 ? "Step 1 of 2 — select the billing customer." : "Step 2 of 2 — booker, passengers & service."
        }
      />

      <div className="flex items-center gap-2 text-sm">
        <Dot n={1} active={step === 1} done={step > 1} label="Customer" />
        <div className="h-px w-8 bg-slate-300" />
        <Dot n={2} active={step === 2} done={false} label="Details" />
      </div>

      {step === 1 && (
        <>
          <Section title="1. Select Customer (Billing)">
            <div className="space-y-4 p-5">
              <Field label="Customer (from customer master)">
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v);
                    setScTouched(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company || c.name}
                        {c.contact_person ? ` · ${c.contact_person}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {customer && <CustomerCard customer={customer} />}
            </div>
          </Section>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/bookings")}>
              Cancel
            </Button>
            <Button onClick={goNext}>
              Next <ArrowRight size={16} />
            </Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {customer && (
            <Section title="Customer (Billing)">
              <div className="p-5">
                <CustomerCard customer={customer} flat />
              </div>
            </Section>
          )}

          <Section title="Booker (who is making the booking)">
            <div className="grid grid-cols-3 gap-4 p-5">
              <Field label="Booked By Name">
                <Input value={booker.name} onChange={(e) => setBooker({ ...booker, name: e.target.value })} />
              </Field>
              <Field label="Booker Mobile">
                <Input value={booker.mobile} onChange={(e) => setBooker({ ...booker, mobile: e.target.value })} />
              </Field>
              <Field label="Booker Email">
                <Input value={booker.email} onChange={(e) => setBooker({ ...booker, email: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section
            title="Passengers (travellers)"
            actions={
              <Button size="sm" variant="outline" onClick={() => setPax((a) => [...a, emptyPax()])}>
                <UserPlus size={15} /> Add Passenger
              </Button>
            }
          >
            <div className="space-y-4 p-5">
              {pax.map((p, i) => (
                <div key={i} className="relative rounded-md border border-slate-200 p-4">
                  {pax.length > 1 && (
                    <button
                      onClick={() => setPax((a) => a.filter((_, idx) => idx !== i))}
                      className="absolute right-3 top-3 text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Name">
                      <Input value={p.name} onChange={(e) => setP(i, "name", e.target.value)} />
                    </Field>
                    <Field label="Mobile">
                      <Input value={p.mobile} onChange={(e) => setP(i, "mobile", e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <Input value={p.email} onChange={(e) => setP(i, "email", e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                Rate and service charge both multiply by passenger count ({paxCount} pax).
              </p>
            </div>
          </Section>

          <Section title="Booking For">
            <div className="p-5">
              <Field label="Choose Service">
                <Select
                  value={svcType}
                  onValueChange={(v) => {
                    setSvcType(v as "hotel" | "flight");
                    setScTouched(false);
                  }}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Choose Hotel or Flight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="flight">Flight</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          {svcType === "hotel" && (
            <Section title="Hotel Details">
              <div className="grid grid-cols-3 gap-4 p-5">
                <Field label="Hotel Name" className="col-span-3">
                  <Input value={hotel.hotel_name} onChange={(e) => setHotel({ ...hotel, hotel_name: e.target.value })} />
                </Field>
                <Field label="Check-in Date">
                  <Input type="date" value={hotel.checkin} onChange={(e) => setHotel({ ...hotel, checkin: e.target.value })} />
                </Field>
                <Field label="Check-in Time">
                  <Input
                    type="time"
                    value={hotel.checkin_time}
                    onChange={(e) => setHotel({ ...hotel, checkin_time: e.target.value })}
                  />
                </Field>
                <Field label="Nights / Days">
                  <Input value={nights ? `${nights}N / ${days}D` : ""} readOnly placeholder="0N / 0D" />
                </Field>
                <Field label="Check-out Date">
                  <Input type="date" value={hotel.checkout} onChange={(e) => setHotel({ ...hotel, checkout: e.target.value })} />
                </Field>
                <Field label="Check-out Time">
                  <Input
                    type="time"
                    value={hotel.checkout_time}
                    onChange={(e) => setHotel({ ...hotel, checkout_time: e.target.value })}
                  />
                </Field>
                <Field label="Rate (₹) — per pax">
                  <Input type="number" value={hotel.rate} onChange={(e) => setHotel({ ...hotel, rate: e.target.value })} />
                </Field>
                <Field label={`Service Charge (₹) — ${paxCount} pax auto`}>
                  <Input type="number" value={scValue} onChange={(e) => setSc(e.target.value)} />
                </Field>
              </div>
              <TotalStrip perPaxRate={perPaxRate} paxCount={paxCount} rateTotal={rateTotal} sc={Number(scValue || 0)} grandTotal={grandTotal} />
            </Section>
          )}

          {svcType === "flight" && (
            <Section title="Flight Details">
              <div className="grid grid-cols-3 gap-4 p-5">
                <Field label="From (Airport Code)">
                  <Input value={flight.origin} onChange={(e) => setFlight({ ...flight, origin: e.target.value })} placeholder="DEL" />
                </Field>
                <Field label="To (Airport Code)">
                  <Input value={flight.destination} onChange={(e) => setFlight({ ...flight, destination: e.target.value })} placeholder="DXB" />
                </Field>
                <Field label="Flight No">
                  <Input value={flight.flight_number} onChange={(e) => setFlight({ ...flight, flight_number: e.target.value })} />
                </Field>
                <Field label="Date of Travel">
                  <Input type="date" value={flight.date} onChange={(e) => setFlight({ ...flight, date: e.target.value })} />
                </Field>
                <Field label="Rate (₹) — per pax">
                  <Input type="number" value={flight.rate} onChange={(e) => setFlight({ ...flight, rate: e.target.value })} />
                </Field>
                <Field label={`Service Charge (₹) — ${paxCount} pax auto`}>
                  <Input type="number" value={scValue} onChange={(e) => setSc(e.target.value)} />
                </Field>
              </div>
              <TotalStrip perPaxRate={perPaxRate} paxCount={paxCount} rateTotal={rateTotal} sc={Number(scValue || 0)} grandTotal={grandTotal} />
            </Section>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={book} disabled={saving}>
              <CheckCircle2 size={16} /> {saving ? "Booking…" : "Book"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function TotalStrip({
  perPaxRate,
  paxCount,
  rateTotal,
  sc,
  grandTotal,
}: {
  perPaxRate: number;
  paxCount: number;
  rateTotal: number;
  sc: number;
  grandTotal: number;
}) {
  if (!perPaxRate && !sc) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
      <span className="text-slate-500">
        {money(perPaxRate)} × {paxCount} pax ={" "}
        <span className="font-medium text-slate-800">{money(rateTotal)}</span>
      </span>
      <span className="text-slate-500">
        Service charge <span className="font-medium text-slate-800">{money(sc)}</span>
      </span>
      <span className="ml-auto text-base">
        Total <span className="font-bold text-slate-900">{money(grandTotal)}</span>
      </span>
    </div>
  );
}

function CustomerCard({ customer, flat = false }: { customer: Customer; flat?: boolean }) {
  const body = (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
      <Info label="Company" value={customer.company || customer.name} />
      <Info label="Contact" value={customer.contact_person || customer.name || "—"} />
      <Info label="Mobile" value={customer.mobile || "—"} />
      <Info label="Email" value={customer.email || "—"} />
      <Info label="GST" value={customer.gst_number || "—"} />
      <Info
        label="Service Charge"
        value={`Hotel ${money(customer.hotel_service_charge)} · Flight ${money(customer.flight_service_charge)} /pax`}
      />
    </div>
  );
  return flat ? body : <div className="rounded-md border border-slate-200 bg-slate-50 p-4">{body}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function Dot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          active ? "bg-slate-900 text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
        }`}
      >
        {n}
      </div>
      <span className={active ? "font-medium text-slate-900" : "text-slate-500"}>{label}</span>
    </div>
  );
}
