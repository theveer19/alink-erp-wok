import React from "react";
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

const NAVY = "#0F172A";
const SLATE = "#64748B";
const BORDER = "#E2E8F0";
const LIGHT = "#F1F5F9";
const INDIGO = "#4F46E5";

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  company: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY },
  small: { fontSize: 8, color: SLATE, lineHeight: 1.4 },
  voucherTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: INDIGO, textAlign: "right" },
  rightLine: { fontSize: 9, textAlign: "right", marginTop: 2 },
  hr: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 10 },
  section: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 4 },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: 90, color: SLATE, fontFamily: "Helvetica-Bold" },
  th: { backgroundColor: NAVY, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8, padding: 5 },
  td: { padding: 5, fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  note: { fontSize: 8, color: SLATE, lineHeight: 1.5 },
});

type Svc = Record<string, unknown>;
interface Company {
  name?: string; address?: string; phone?: string; email?: string; website?: string; gst_number?: string;
}
interface Booking {
  booking_number: string;
  customer_snapshot?: { name?: string } | null;
  destination?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  num_travellers?: number | null;
  hotels?: Svc[]; flights?: Svc[]; others?: Svc[];
}

const g = (v: unknown) => (v == null ? "" : String(v));
const d = (v: unknown) => g(v).slice(0, 10);

function Col({ children, w }: { children: React.ReactNode; w: string | number }) {
  return <View style={{ width: w as number }}>{children}</View>;
}

function VoucherDoc({ booking, company }: { booking: Booking; company: Company }) {
  const cust = booking.customer_snapshot ?? {};
  const hotels = booking.hotels ?? [];
  const flights = booking.flights ?? [];
  const others = booking.others ?? [];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View style={{ width: 300 }}>
            <Text style={s.company}>{company.name || "Booking Voucher"}</Text>
            <View style={{ marginTop: 4 }}>
              {company.address ? <Text style={s.small}>{company.address}</Text> : null}
              {company.phone ? <Text style={s.small}>Phone: {company.phone}</Text> : null}
              {company.email ? <Text style={s.small}>Email: {company.email}</Text> : null}
              {company.gst_number ? <Text style={s.small}>GSTIN: {company.gst_number}</Text> : null}
            </View>
          </View>
          <View style={{ width: 200 }}>
            <Text style={s.voucherTitle}>BOOKING VOUCHER</Text>
            <Text style={s.rightLine}>Booking ID: {booking.booking_number}</Text>
            <Text style={s.rightLine}>Issued: {new Date().toISOString().slice(0, 10)}</Text>
          </View>
        </View>

        <View style={s.hr} />

        <View style={s.infoRow}><Text style={s.infoLabel}>Customer</Text><Text>{g(cust.name)}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Destination</Text><Text>{g(booking.destination)}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Travel Dates</Text><Text>{d(booking.travel_start_date)} to {d(booking.travel_end_date)}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Travellers</Text><Text>{g(booking.num_travellers)}</Text></View>

        {hotels.length > 0 && (
          <>
            <Text style={s.section}>HOTEL DETAILS</Text>
            <View style={s.row}>
              <Col w={110}><Text style={s.th}>Hotel</Text></Col>
              <Col w={70}><Text style={s.th}>City</Text></Col>
              <Col w={140}><Text style={s.th}>Check-in / out</Text></Col>
              <Col w={90}><Text style={s.th}>Room / Meal</Text></Col>
              <Col w={90}><Text style={s.th}>Confirmation #</Text></Col>
            </View>
            {hotels.map((h, i) => (
              <View style={[s.row, { backgroundColor: i % 2 ? LIGHT : "#fff" }]} key={i}>
                <Col w={110}><Text style={s.td}>{g(h.hotel_name)}</Text></Col>
                <Col w={70}><Text style={s.td}>{g(h.city)}</Text></Col>
                <Col w={140}><Text style={s.td}>{d(h.checkin)} to {d(h.checkout)}</Text></Col>
                <Col w={90}><Text style={s.td}>{g(h.room_category)} / {g(h.meal_plan)}</Text></Col>
                <Col w={90}><Text style={s.td}>{g(h.confirmation_number)}</Text></Col>
              </View>
            ))}
          </>
        )}

        {flights.length > 0 && (
          <>
            <Text style={s.section}>FLIGHT DETAILS</Text>
            <View style={s.row}>
              <Col w={90}><Text style={s.th}>Airline</Text></Col>
              <Col w={70}><Text style={s.th}>Flight</Text></Col>
              <Col w={70}><Text style={s.th}>PNR</Text></Col>
              <Col w={130}><Text style={s.th}>Sector</Text></Col>
              <Col w={140}><Text style={s.th}>Departure</Text></Col>
            </View>
            {flights.map((f, i) => (
              <View style={[s.row, { backgroundColor: i % 2 ? LIGHT : "#fff" }]} key={i}>
                <Col w={90}><Text style={s.td}>{g(f.airline)}</Text></Col>
                <Col w={70}><Text style={s.td}>{g(f.flight_number)}</Text></Col>
                <Col w={70}><Text style={s.td}>{g(f.pnr)}</Text></Col>
                <Col w={130}><Text style={s.td}>{g(f.origin)} → {g(f.destination)}</Text></Col>
                <Col w={140}><Text style={s.td}>{d(f.departure_date)} {g(f.departure_time)}</Text></Col>
              </View>
            ))}
          </>
        )}

        {others.length > 0 && (
          <>
            <Text style={s.section}>OTHER SERVICES</Text>
            <View style={s.row}>
              <Col w={140}><Text style={s.th}>Service</Text></Col>
              <Col w={360}><Text style={s.th}>Details</Text></Col>
            </View>
            {others.map((o, i) => (
              <View style={[s.row, { backgroundColor: i % 2 ? LIGHT : "#fff" }]} key={i}>
                <Col w={140}><Text style={s.td}>{g(o.service_type)}</Text></Col>
                <Col w={360}><Text style={s.td}>{g(o.description)}</Text></Col>
              </View>
            ))}
          </>
        )}

        <Text style={s.section}>Important Instructions</Text>
        <Text style={s.note}>
          Please carry a valid photo ID for all check-ins. Standard hotel check-in is 2:00 PM and
          check-out is 12:00 PM. Please reach the airport at least 3 hours before international departures.
        </Text>

        <Text style={s.section}>Company Contact</Text>
        <Text style={s.note}>
          {g(company.name)} {company.phone ? `| ${company.phone}` : ""} {company.email ? `| ${company.email}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderVoucherPdf(booking: Booking, company: Company): Promise<Buffer> {
  return renderToBuffer(<VoucherDoc booking={booking} company={company} />);
}
