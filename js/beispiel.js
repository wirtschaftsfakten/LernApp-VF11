// Beispiel-Lernset aus den Arbeitsblättern "Eine Frage der Ehre" (BS4, Texte erfassen).
// Abgetippt aus den Fotos im Ordner beispiel-dokumente.

// Fächer laut Stundenplan (Religion/Ethik bewusst weggelassen)
export const FAECHER = [
  { name: 'D – Deutsch', color: 'lila' },
  { name: 'SVV – Sozialversicherungslehre', color: 'gruen' },
  { name: 'E – Englisch', color: 'blau' },
  { name: 'BGP – Betriebswirtschaftliche Geschäftsprozesse', color: 'gelb' },
  { name: 'PVF – Private Versicherungsfälle', color: 'pink' },
  { name: 'KGP – Kaufmännische Geschäftsprozesse', color: 'orange' },
  { name: 'PuG – Politik und Gesellschaft', color: 'gruen' },
];

// Englisch: Espresso English, Reading Comprehension Lesson 20 (Gratis-Probelektion).
// Lesetext bleibt auf der Originalseite; hier nur Vokabeln und Verständnisfragen.
// Lösungen aus dem Text abgeleitet, die Seite hat keinen Lösungsschlüssel.
export const ENGLISCH_READING = {
  subject: 'E – Englisch',
  test: { title: 'Englisch-Test', notes: '' },
  name: 'Reading 20: Staying motivated and productive',
  kind: 'text',
  highlights: [],
  text: `Quelle: https://courses.espressoenglish.net/courses/free-sample-lessons/lessons/free-sample-reading-course/

Name the six tips from the text for staying productive?
Create a constructive environment
Change your routine
Write a list
Make small tasks
Set up a reward system
Take care of yourself

How should you set up your workspace?
In a way that helps you be productive (light, noise, no clutter, everything at hand).

What can happen if you keep the same routine for too long?
It might cause you to get stuck (in a rut).

Why does writing a list help?
It helps the tasks seem achievable.

What should you do if you want to write a book?
Focus on getting small parts of it done.

What is important about rewards?
They should have a specific (time) limit.

What should you NOT do, according to the last tip?
Pressure yourself to do too much.

tedious: langweilig, eintönig
to get sidetracked: abgelenkt werden
crushed: überwältigt, niedergedrückt
sheer (amount): schiere (Menge)
to optimize: optimieren
to grease the wheels: den Ablauf reibungsloser machen
conducive to: förderlich für
apt to: neigen zu
scatter-brained: zerstreut, unkonzentriert
cluttered: unordentlich, überladen
at hand: griffbereit
cocoon: kleiner, geschützter Raum
to get down to business: ernsthaft anfangen
burnt out: ausgebrannt
in a rut: in einem Trott feststecken
a breath of fresh air: frische Abwechslung
to spark: anregen, auslösen
time-honored: traditionell bewährt
daunting: entmutigend
to cross off: abhaken
bite-sized: mundgerecht, überschaubar
to dive in: sich hineinstürzen, anpacken
leisure: Freizeit
to binge: exzessiv konsumieren
to push yourself: sich antreiben, überfordern
on top of your game: in Bestform sein
to supercharge: stark steigern`,
};

// Fragen der Kurzarbeit (so von der Parallelklasse weitergegeben).
// Antworten NUR aus den Unterlagen: Arbeitsblatt Aufgabe 3 und 4 sowie wörtliche Stellen aus dem Lesetext.
export const KURZARBEIT = {
  name: 'Kurzarbeit: Fragen der Parallelklasse',
  oldNames: ['Kurzarbeit: erwartete Fragen'],
  kind: 'text',
  highlights: [],
  text: `Nenne 8 Tugenden.
Arbeitsblatt Aufgabe 4: gutes Erscheinungsbild, gute Erziehung, Ordnungssinn, Klugheit, Höflichkeit, Friedensliebe, Ehrlichkeit, Vorsicht, Misstrauen, Ernsthaftigkeit, Wagemut im richtigen Moment, Wahrung von Geschäftsgeheimnissen

Was haben die ehrbaren Kaufleute für Eigenschaften und weshalb war Gemeinschaft im Mittelalter so wichtig?
Eigenschaften (Arbeitsblatt Aufgabe 3): Humanistische Grundbildung, umfassendes Fachwissen, gefestigter Charakter.
Lesetext: „Ein Kaufmann musste über praktische Fähigkeiten verfügen“ – „Rechnen, Lesen, Sprachkenntnisse, Bildung in den Bereichen Warenkunde, Recht, Geografie und Währung wurden ergänzt durch ein ausgeprägtes Gewinnstreben, durch rationale und emotionale Intelligenz, Organisationstalent sowie politischen Weitblick“.
Gemeinschaft (Lesetext): Wer betrog, täuschte oder Pleite machte, verlor seinen guten Ruf und das Vertrauen seiner Kunden, was unweigerlich zu seinem Ruin führte. Schande sei zudem gleichbedeutend mit dem Ausschluss aus der Gemeinschaft gewesen. So durfte ein schandhafter Kaufmann keine Ämter mehr bekleiden und wurde im schlimmsten Fall aus der Stadt getrieben. „Ein ehrbarer Kaufmann tat sich Gutes, indem er ehrbar wirtschaftete und damit seinen eigenen und den Wohlstand der Gemeinschaft mehrte“.`,
};

export const BEISPIEL = {
  subject: { name: 'D – Deutsch', color: 'lila' },
  test: { title: 'Eine Frage der Ehre – Der ehrbare Kaufmann', daysAhead: 9, notes: 'Kurzarbeit – Fragen der Parallelklasse' },
  docs: [
    KURZARBEIT,
    {
      name: 'Lesetext: Eine Frage der Ehre',
      urls: ['beispiel-blaetter/lesetext-1.jpg', 'beispiel-blaetter/lesetext-2.jpg'],
      kind: 'text',
      highlights: ['italienischen Venedig', 'norddeutschen Städtebund', 'Christoph Lütge', 'Skepsis', 'Betrüger', 'Kaufmannsgilden', 'Vereinigungen',
        'Verhaltensnormen', 'Grundsatz von Treu und Glauben', 'Gütesiegel', 'praktische Fähigkeiten', 'Warenkunde', 'Recht', 'Geografie', 'Währung',
        'rationale und emotionale Intelligenz', 'Organisationstalent', 'politischen Weitblick', 'Ehre', 'Handelsmonopole', 'Verantwortung für ihre Heimat',
        'christlichen Werten', 'Vernunft und Moral', 'Gesellschaftliches Ansehen', 'Reichtum', 'Good Governance', 'Fair Play', 'Corporate Social Responsibility',
        'Verantwortungsbewusstsein', 'Wirtschaftlichkeit und Moral sind beim ehrbaren Kaufmann keine Gegensätze'],
      text: `Eine Frage der Ehre

In Zeiten immer neuer Wirtschafts-Skandale und Krisen feiert der ehrbare Kaufmann eine Renaissance. Woher das traditionelle Leitbild ursprünglich stammt und welche Werte man heute damit verknüpft.

Das Leitbild des ehrbaren Kaufmanns hat eine lange Tradition. Nachweislich seit dem 12. Jahrhundert wurden in Europa bestimmte Tugenden in den Handbüchern der Kaufleute gelehrt. Die Wurzeln liegen im italienischen Venedig und den norddeutschen Städtebund der Hanse. Von dem Handelszentrum im Süden ausgehend verbreitete sich das Leitbild über die Kaufmanns-Vereinigungen im Norden in ganz Europa.

Christoph Lütge, Inhaber des Lehrstuhls für Wirtschaftsethik an der Technischen Universität München, hat sich intensiv mit der Geschichte des ehrbaren Kaufmanns beschäftigt. Die ersten Kaufleute – im frühen Mittelalter noch zu Fuß und zu Wasser unterwegs – lebten demnach auf ihren Reisen gefährlich und mussten hohe Risiken eingehen, weil sie in jeder Stadt fremd und ohne jegliche Reputation waren. „Oftmals begegnete man den Reisenden mit Skepsis oder sie wurden gar als Betrüger verdächtigt“, sagt Lütge. Das erschwerte den Handel beträchtlich. Um das Vertrauen in die Kaufleute zu stärken und die Bedingungen des Wirtschaftens zu verbessern, entstanden mit dem Aufstreben der Städte ab der Mitte des 12. Jahrhunderts vielerorts Kaufmannsgilden und Vereinigungen wie die Hanse. Nach Auskunft des Wissenschaftlers standen sie für spezifische Verhaltensnormen nach dem Grundsatz von Treu und Glauben und fungierten als Gütesiegel.

Bestimmte Fähigkeiten sind gefordert
Joachim Schwalbach, ehemaliger Leiter des Instituts für Management der Humboldt Universität Berlin, hat sich während seiner langjährigen Forschungsarbeit ebenfalls mit dem ehrbaren Kaufmann auseinandergesetzt. Seiner Ansicht nach zeichne dieser sich seit jeher durch eine gute humanistische Grundbildung aus. Darauf aufbauend besitzt er umfassendes Fachwissen und einen gefestigten Charakter, sagt er. „Ein Kaufmann musste über praktische Fähigkeiten verfügen“, erläutert der Betriebswirt die Anforderungen im Mittelalter. Jene seien eine wichtige Basis seines wirtschaftlichen Erfolgs gewesen. „Rechnen, Lesen, Sprachkenntnisse, Bildung in den Bereichen Warenkunde, Recht, Geografie und Währung wurden ergänzt durch ein ausgeprägtes Gewinnstreben, durch rationale und emotionale Intelligenz, Organisationstalent sowie politischen Weitblick“, betont Schwalbach. Doch das allein macht noch keinen ehrbaren Kaufmann aus. Die Ehrbarkeit entstand erst durch tugendhaftes Verhalten. „Bis zum Anbruch der Moderne wurde Ehre als soziales Kapital verstanden, dessen Wert man steigern oder durch schändliches Verhalten verlieren konnte“, sagt Schwalbach. Wer betrog, täuschte oder Pleite machte, verlor seinen guten Ruf und das Vertrauen seiner Kunden, was unweigerlich zu seinem Ruin führte. Schande sei zudem gleichbedeutend mit dem Ausschluss aus der Gemeinschaft gewesen, sagt Schwalbach. So durfte ein schandhafter Kaufmann keine Ämter mehr bekleiden und wurde im schlimmsten Fall aus der Stadt getrieben. Grundlegende Tugenden waren im Mittelalter Ehrlichkeit, Vorsicht, Misstrauen, die Wahrung von Geschäftsgeheimnissen, Wagemut im richtigen Moment, Friedensliebe, Ernsthaftigkeit, Höflichkeit, Klugheit, Ordnung, eine gute Erscheinung und eine gute Erziehung. „Ein ehrbarer Kaufmann tat sich Gutes, indem er ehrbar wirtschaftete und damit seinen eigenen und den Wohlstand der Gemeinschaft mehrte“, erläutert Schwalbach. Dadurch entwickelte sich eine pragmatische Geschäftsmoral des goldenen Mittelwegs mit dem Ziel, den geschäftlichen Erfolg langfristig zu sichern – auch über Generationen hinweg.

Die Rahmenbedingungen ändern sich
Im 15. Jahrhundert gelangten die Kaufleute zu größerem Einfluss. „Die Hanse im Norden oder die Fugger und Welser im Süden von Deutschland bildeten regelrechte Handelsmonopole heraus“, erklärt Lütge. Die Ehrbarkeit spielt hierbei demzufolge eine wichtige Rolle. „Viele Kaufleute fühlten sich ethischen Grundsätzen verpflichtet. Sie folgten nicht nur bei ihren Geschäftsabwicklungen klaren Prinzipien, sondern sie übernahmen auch Verantwortung für ihre Heimat“, sagt der Wirtschaftsethiker der Technischen Universität München. Der Grund: Die Kaufleute wollten ihrer Region etwas zurückgeben, da diese ihren gesellschaftlichen Aufstieg erst ermöglichte.

Im Laufe der Zeit passten sich die ethischen Regeln immer wieder an gewandelte ökonomische Rahmenbedingungen an. „In ihrem Kern blieben die Grundsätze aber unverändert. Sie basieren auf christlichen Werten und standen für Verantwortung“, betont Lütge. Nach Jahrhunderten blühender Handelsbeziehungen folgte der wirtschaftliche Stillstand während des Dreißigjährigen Krieges (1614-1648) und der Niedergang der Hanse. Im 17. und 18. Jahrhundert wandelte sich die Wertvorstellung in der Wirtschaft fundamental. „Im Zuge der Aufklärung trat die Religion als Grundlage des kaufmännischen Ehrverständnisses zugunsten von Vernunft und Moral zurück“, sagt Lütge. Mit dem Beginn der Industrialisierung im 18. Jahrhundert seien die Tugenden des ehrbaren Kaufmanns zunehmend in Vergessenheit geraten. Gesellschaftliches Ansehen erwarb ein Unternehmer demnach nun durch größtmöglichen Reichtum und nicht mehr durch gemeinnütziges Engagement. Anspruch und Wirklichkeit entkoppelten sich auch dadurch, dass Betriebe immer öfter nicht durch Eigentümer, sondern durch angestellte Geschäftsführer geleitet wurden, die dem Druck, immer größere Gewinne zu erzielen, nicht so leicht widerstehen konnten. „In der Folgezeit wurde deutlich, dass diese neuen Maßstäbe Unternehmertum und Gesellschaft stark entzweiten. Das Wirtschaften ohne Verantwortungsübernahme ging vor allem auf Kosten der Arbeitnehmer, was letztlich zu Arbeiteraufständen führte“, erklärt Lütge.

Der Ruf nimmt Schaden
In der heutigen Gesellschaft scheinen Ökonomie und Moral häufig nicht miteinander vereinbar zu sein: Die Finanzmarkt- und Wirtschaftskrise erschütterte das Vertrauen in die Wirtschaft, verschärfte den Wettbewerb zwischen den Unternehmen. In der Öffentlichkeit entstand der Eindruck, dass wirtschaftliche Aktivitäten und gesellschaftliche Interessen im Widerspruch zueinanderstehen. Im Markt selbst führte die Ellenbogenmentalität vermehrt zu Pleiten. Um diesem Negativtrend entgegenzusteuern, entdeckten zwischen 2007 und 2009 viele Unternehmen die Tugenden des Mittelalters wieder. Der Begriff des ehrbaren Kaufmanns wird heute zunehmend durch Anglizismen wie Good Governance, Fair Play und Corporate Social Responsibility verdrängt. Im Unterschied zu vergangenen Zeiten besteht aber weit weniger Konsens darüber, was einen verantwortungsbewussten Geschäftsmann auszeichnet.

Schwalbach hat hierzu ganz konkrete Vorstellungen: „Ein moderner ehrbarer Kaufmann hat ein ausgeprägtes Verantwortungsbewusstsein auf der Unternehmens- und Gesellschaftsebene“, sagt der frühere Professor der Humboldt Universität Berlin. Dazu gehöre das faire Verhalten gegenüber seinen Mitarbeitern, Kunden und Geschäftspartnern, die er nach tugendhaften Grundsätzen behandle – mit dem Ziel, langfristige Beziehungen aufzubauen und zu halten. Die Verantwortung gegenüber der Gesellschaft drückt sich zum Beispiel durch Engagement am Standort des Unternehmens, die Verteidigung der sozialen Marktwirtschaft und die Berücksichtigung des Umweltschutzes bei allen Entscheidungen aus. „Wirtschaftlichkeit und Moral sind beim ehrbaren Kaufmann keine Gegensätze“, resümiert Schwalbach. Das traditionelle Leitbild ist seiner Ansicht nach für die Gegenwart von außerordentlicher Wichtigkeit: „Es sollte Unternehmern und Managern bewusst machen, dass verantwortungsvolles Verhalten die Grundlage für den nachhaltigen wirtschaftlichen Erfolg und für den sozialen Frieden in der Gesellschaft darstellt.“

Andre Gieße – Quelle: Verkehrsrundschau 30/2014`,
    },
    {
      name: 'Arbeitsblatt: Fragen 1–9',
      urls: ['beispiel-blaetter/arbeitsblatt-1.jpg', 'beispiel-blaetter/arbeitsblatt-2.jpg'],
      kind: 'text',
      highlights: [],
      text: `1. Welche Probleme hatten die Kaufleute im frühen Mittelalter?
Das Ansehen in der Bevölkerung war schlecht

2. Wie konnte das Ansehen der Kaufleute verbessert werden?
Durch die Bildung von Kaufmannsgilden und Vereinigungen (Hanse); sie standen als Gütesiegel für Treu und Glauben.

3. Was zeichnete damals einen ehrbaren Kaufmann aus?
Humanistische Grundbildung, umfassendes Fachwissen, gefestigter Charakter.

4. Was waren im Mittelalter die grundlegenden Tugenden?
gutes Erscheinungsbild, gute Erziehung, Ordnungssinn, Klugheit, Höflichkeit, Friedensliebe, Ehrlichkeit, Vorsicht, Misstrauen, Ernsthaftigkeit, Wagemut im richtigen Moment, Wahrung von Geschäftsgeheimnissen

5. Welche Kaufleute bildeten im 15. Jahrhundert regelrechte Monopole?
Fugger & Welser (Süden); Hanse (Norden)

6. Inwiefern war zu diesem Zeitpunkt die Ehrbarkeit ein wichtiger Grundsatz?
Die Kaufleute übernahmen Verantwortung für die Heimat. Gutes für seinen eigenen Wohlstand und den Wohlstand der Gemeinschaft.

7. Warum änderte sich dieser Grundsatz im 18. Jahrhundert?
Zeit der Industrialisierung; gesellschaftliches Ansehen durch größtmöglichen Reichtum; Leitung durch Geschäftsführer statt durch die Eigentümer

8. Von welchen Begriffen wird das Bild des ehrbaren Kaufmanns heute übernommen?
Good Governance, Fair Play, Corporate Social Responsibility

9. Wie sollte sich ein moderner ehrbarer Kaufmann heutzutage verhalten?
a) Unternehmensebene: Faires Verhalten gegenüber seinen Mitarbeitern, Kunden und Geschäftspartnern. Ziel: Langfristige Beziehung aufbauen.
b) Gesellschaftsebene: Engagement am Standort des Unternehmens; Verteidigung der sozialen Marktwirtschaft; Berücksichtigung des Umweltschutzes`,
    },
    {
      name: 'Arbeitsblatt: Begriffe (Aufgabe 10)',
      urls: ['beispiel-blaetter/arbeitsblatt-2.jpg'],
      kind: 'text',
      highlights: [],
      text: `fungieren: verrichten, vollbringen, vollziehen
resümieren: zusammenfassen, festhalten
humanistisch: von der Achtung der Würde des Menschen geprägt
tugendhaft: sittlich, moralisch
pragmatisch: sachbezogen, lösungsorientiert
fundamental: grundlegend
Gilde: Zusammenschluss von Kaufleuten; Berufsverband
Reputation: das Ansehen einer Person
Verhaltensnormen: Verhaltensregeln
Ethik: Sittenlehre
Anglizismen: Ausdrücke, die aus der englischen Sprache in die deutsche Sprache übernommen wurden`,
    },
    {
      name: 'Duden-Auszug & § 1 IHK-Gesetz',
      urls: ['beispiel-blaetter/duden-ihk.jpg'],
      kind: 'text',
      highlights: ['Anstand und Sitte des ehrbaren Kaufmanns'],
      text: `Tugend: eine moralisch gute Eigenschaft; moralisch vorbildliches Verhalten

§ 1 des IHK Gesetz
Die Industrie- und Handelskammer (IHK) sind 1956 vom Gesetzgeber beauftragt worden, für „Anstand und Sitte des ehrbaren Kaufmanns“ zu wirken.
„Die Industrie- und Handelskammern haben die Aufgabe, durch Vorschläge, Gutachten und Berichte die Behörden zu unterstützen und zu beraten sowie für Wahrung von Anstand und Sitte des ehrbaren Kaufmanns zu wirken.“`,
    },
  ],
};
