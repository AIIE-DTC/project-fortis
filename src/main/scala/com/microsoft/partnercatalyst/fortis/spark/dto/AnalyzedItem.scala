package com.microsoft.partnercatalyst.fortis.spark.dto

import java.util.UUID

case class AnalyzedItem(
  id: UUID,
  createdAtEpoch: Long,
  body: String,
  title: String,
  publisher: String,
  sourceUrl: String,
  sharedLocations: List[Location] = List(),
  analysis: Analysis
)

case class Analysis(
  language: Option[String] = None,
  locations: List[Location] = List(),
  sentiments: List[Double] = List(),
  moods: List[Tag] = List(),
  genders: List[Tag] = List(),
  keywords: List[Tag] = List(),
  entities: List[Tag] = List(),
  summary: Option[String] = None
)

case class Location(
  wofId: String,
  confidence: Option[Double] = None,
  latitude: Option[Double] = None,
  longitude: Option[Double] = None
)

case class Tag(
  name: String,
  confidence: Option[Double]
)