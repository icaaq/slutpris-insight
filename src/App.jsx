import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

const PRICE_STEP = 50000;
const DEFAULT_MIN_PRICE = 4000000;
const DEFAULT_SOLD_RANGE = "2y";

const SOLD_DATE_OPTIONS = [
  { value: "all", label: "Visa alla datum" },
  { value: "6m", label: "Senaste 6 månaderna" },
  { value: "1y", label: "Senaste 1 året" },
  { value: "2y", label: "Senaste 2 åren" },
  { value: "3y", label: "Senaste 3 åren" },
  { value: "4y", label: "Senaste 4 åren" },
  { value: "5y", label: "Senaste 5 åren" },
];

const SORT_FIELDS = [
  { value: "soldDate", label: "Såld datum" },
  { value: "askingPrice", label: "Utgångspris" },
  { value: "finalPrice", label: "Slutpris" },
  { value: "percentChange", label: "Skillnad" },
];

const VIEW_MODES = [
  { value: "card", label: "Kort" },
  { value: "table", label: "Tabell" },
];

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allProperties, setAllProperties] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 0]);
  const [appliedPriceRange, setAppliedPriceRange] = useState([0, 0]);
  const [soldDateRange, setSoldDateRange] = useState(DEFAULT_SOLD_RANGE);
  const [sortField, setSortField] = useState("soldDate");
  const [viewMode, setViewMode] = useState("table");
  const [isSliding, setIsSliding] = useState(false);
  const sliderTimeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const basePath = import.meta.env.BASE_URL || "/";
        const buildUrl = (file) => `${basePath}data/${file}`;

        const [booliResponse, hemnetResponse] = await Promise.all([
          fetch(buildUrl("booli.json")),
          fetch(buildUrl("hemnet.json")),
        ]);

        if (!booliResponse.ok || !hemnetResponse.ok) {
          throw new Error("Kunde inte ladda data");
        }

        const [booliData, hemnetData] = await Promise.all([
          booliResponse.json(),
          hemnetResponse.json(),
        ]);

        const normalizedBooli = booliData.map((property) =>
          normalizeProperty(property, "booli")
        );
        const normalizedHemnet = hemnetData.map((property) =>
          normalizeProperty(property, "hemnet")
        );

        const combined = [...normalizedBooli, ...normalizedHemnet].sort(
          (a, b) => (getSoldTimestamp(b) ?? 0) - (getSoldTimestamp(a) ?? 0)
        );

        if (isMounted) {
          setAllProperties(combined);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Något gick fel när data hämtades");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const priceBounds = useMemo(
    () => getPriceBounds(allProperties),
    [allProperties]
  );

  const defaultMinPrice = useMemo(
    () => getDefaultMinPrice(priceBounds.min, priceBounds.max),
    [priceBounds.min, priceBounds.max]
  );

  useEffect(() => {
    if (priceBounds.max > 0) {
      const initialRange = [defaultMinPrice, priceBounds.max];
      setPriceRange(initialRange);
      setAppliedPriceRange(initialRange);
    }
  }, [priceBounds.max, defaultMinPrice]);

  const soldAfterTimestamp = useMemo(
    () => getLookbackTimestamp(soldDateRange),
    [soldDateRange]
  );

  const { includedProperties, excludedProperties } = useMemo(() => {
    if (!allProperties.length) {
      return { includedProperties: [], excludedProperties: [] };
    }

    const minPrice = appliedPriceRange[0] ?? priceBounds.min;
    const maxPrice = appliedPriceRange[1] ?? priceBounds.max;

    const included = [];
    const excluded = [];

    allProperties.forEach((property) => {
      const priceMatch =
        property.askingPrice >= minPrice && property.askingPrice <= maxPrice;
      const saleTimestamp = getSoldTimestamp(property);
      const dateMatch =
        !soldAfterTimestamp ||
        (saleTimestamp !== null && saleTimestamp >= soldAfterTimestamp);

      if (priceMatch && dateMatch) {
        included.push(property);
      } else {
        excluded.push(property);
      }
    });

    return { includedProperties: included, excludedProperties: excluded };
  }, [
    allProperties,
    priceBounds.min,
    priceBounds.max,
    appliedPriceRange,
    soldAfterTimestamp,
  ]);

  const sortedIncluded = useMemo(
    () => sortProperties(includedProperties, sortField),
    [includedProperties, sortField]
  );

  const sortedExcluded = useMemo(
    () => sortProperties(excludedProperties, sortField),
    [excludedProperties, sortField]
  );

  const stats = useMemo(() => calculateStats(sortedIncluded), [sortedIncluded]);

  const handleSliderChange = (_, newValue) => {
    if (!Array.isArray(newValue)) return;
    const [min, max] = newValue;
    const snappedMin = snapToStep(
      clamp(min, priceBounds.min, priceBounds.max),
      PRICE_STEP
    );
    const snappedMax = snapToStep(
      clamp(max, priceBounds.min, priceBounds.max),
      PRICE_STEP
    );

    const normalizedRange = [
      Math.min(snappedMin, snappedMax),
      Math.max(snappedMin, snappedMax),
    ];

    setPriceRange(normalizedRange);
    setIsSliding(true);

    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current);
    }

    sliderTimeoutRef.current = setTimeout(() => {
      setAppliedPriceRange(normalizedRange);
      setIsSliding(false);
      sliderTimeoutRef.current = null;
    }, 400);
  };

  const handleSortFieldChange = (event) => {
    setSortField(event.target.value);
  };

  const handleDateRangeChange = (event) => {
    setSoldDateRange(event.target.value);
  };

  const handleViewModeChange = (_, value) => {
    if (value) {
      setViewMode(value);
    }
  };

  const handleResetFilters = () => {
    const resetRange = [defaultMinPrice, priceBounds.max];
    setPriceRange(resetRange);
    setAppliedPriceRange(resetRange);
    setIsSliding(false);
    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current);
      sliderTimeoutRef.current = null;
    }
    setSoldDateRange(DEFAULT_SOLD_RANGE);
  };

  useEffect(() => {
    return () => {
      if (sliderTimeoutRef.current) {
        clearTimeout(sliderTimeoutRef.current);
        sliderTimeoutRef.current = null;
      }
    };
  }, []);

  const isDataReady = !loading && !error;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          Slutprisanalys av bostäder i Mora
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Få en snabb översikt över genomsnitt, median och försäljningsvolym
          från Booli och Hemnet.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Filtrera resultat
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Typography variant="body2" fontWeight={600} mb={1}>
              Prisintervall (utgångspris)
            </Typography>
            <Box mb={2} display="flex" justifyContent="space-between">
              <Typography variant="body1" fontWeight={500}>
                {formatPrice(priceRange[0])} kr
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {formatPrice(priceRange[1])} kr
              </Typography>
            </Box>
            <Slider
              value={priceRange}
              onChange={handleSliderChange}
              min={priceBounds.min}
              max={priceBounds.max}
              step={PRICE_STEP}
              valueLabelDisplay="off"
              disableSwap
              sx={{
                color: "text.primary",
                "& .MuiSlider-track": { border: "none" },
                "& .MuiSlider-thumb": {
                  width: 18,
                  height: 18,
                  "&:before": { boxShadow: "0 0 0 8px rgba(17, 24, 39, 0.16)" },
                  "&:hover, &.Mui-focusVisible": {
                    boxShadow: "none",
                  },
                },
                "& .MuiSlider-rail": {
                  opacity: 0.4,
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="sold-date-range-label">Datumintervall</InputLabel>
              <Select
                labelId="sold-date-range-label"
                value={soldDateRange}
                label="Datumintervall"
                onChange={handleDateRangeChange}
              >
                {SOLD_DATE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="sort-field-label">Sortera efter</InputLabel>
              <Select
                labelId="sort-field-label"
                value={sortField}
                label="Sortera efter"
                onChange={handleSortFieldChange}
              >
                {SORT_FIELDS.map((field) => (
                  <MenuItem key={field.value} value={field.value}>
                    {field.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              onClick={handleResetFilters}
              sx={{ mt: 2 }}
            >
              Återställ filter
            </Button>
            {isSliding && (
              <Stack direction="row" spacing={1} alignItems="center" mt={2}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Uppdaterar resultat...
                </Typography>
              </Stack>
            )}
          </Grid>
        </Grid>
      </Paper>

      {loading && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="40vh"
        >
          <CircularProgress />
        </Box>
      )}

      {isDataReady && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Genomsnitt"
                value={`${stats.average.toFixed(2)}%`}
                emphasis
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Median"
                value={`${stats.median.toFixed(2)}%`}
                emphasis
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Fördelning"
                value={`${sortedIncluded.length} / ${allProperties.length}`}
                subtitle="Inkluderade / Totalt"
              />
            </Grid>
          </Grid>

          <Box
            mb={2}
            display="flex"
            flexDirection={{ xs: "column", md: "row" }}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            gap={2}
          >
            <Typography variant="h6">
              {viewMode === "card" ? "Kortvy" : "Tabellvy"}
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              {VIEW_MODES.map((mode) => (
                <ToggleButton key={mode.value} value={mode.value}>
                  {mode.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {isSliding ? (
            <Paper
              variant="outlined"
              sx={{
                py: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                bgcolor: "background.default",
              }}
            >
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Uppdaterar resultat baserat på det valda intervallet...
              </Typography>
            </Paper>
          ) : viewMode === "card" ? (
            <CardView included={sortedIncluded} excluded={sortedExcluded} />
          ) : (
            <TableView included={sortedIncluded} excluded={sortedExcluded} />
          )}
        </>
      )}
    </Container>
  );
}

function CardView({ included, excluded }) {
  return (
    <Stack spacing={4}>
      <Box>
        <SectionHeading title="Inkluderade försäljningar" />
        {included.length === 0 ? (
          <EmptyState message="Inga objekt matchar nuvarande filter." />
        ) : (
          <Grid container spacing={2.5}>
            {included.map((property) => (
              <Grid key={property.id} item xs={12} sm={6} md={4}>
                <PropertyCard property={property} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Box>
        <SectionHeading title="Exkluderade försäljningar" subdued />
        {excluded.length === 0 ? (
          <EmptyState message="Inga objekt exkluderas med nuvarande filter." />
        ) : (
          <Grid container spacing={2.5}>
            {excluded.map((property) => (
              <Grid key={property.id} item xs={12} sm={6} md={4}>
                <PropertyCard property={property} muted />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}

function PropertyCard({ property, muted = false }) {
  const percentage = Number(property.percentChange) || 0;
  const percentageColor = percentage >= 0 ? "success" : "error";

  return (
    <Card
      variant="outlined"
      sx={{
        opacity: muted ? 0.55 : 1,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        "&:hover": {
          borderColor: muted ? "divider" : "secondary.light",
          boxShadow: muted ? "none" : "0 12px 24px rgba(15, 23, 42, 0.12)",
        },
      }}
    >
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={1}
        >
          <Typography variant="subtitle1" fontWeight={600} sx={{ pr: 1 }}>
            {property.address}
          </Typography>
          <Chip
            size="small"
            label={property.source}
            sx={{
              textTransform: "capitalize",
              fontWeight: 600,
              letterSpacing: 0.6,
              bgcolor:
                property.source === "hemnet"
                  ? "rgba(22, 163, 74, 0.16)"
                  : "rgba(17, 24, 39, 0.12)",
              color:
                property.source === "hemnet"
                  ? "rgba(22, 101, 52, 0.95)"
                  : "#111827",
              border: "1px solid",
              borderColor:
                property.source === "hemnet"
                  ? "rgba(22, 163, 74, 0.4)"
                  : "rgba(17, 24, 39, 0.35)",
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {property.area}
        </Typography>
        <Stack spacing={0.5}>
          <PropertyInfo
            label="Utgångspris"
            value={`${formatPrice(property.askingPrice)} kr`}
          />
          <PropertyInfo
            label="Slutpris"
            value={`${formatPrice(property.finalPrice)} kr`}
          />
          <PropertyInfo label="Såld" value={formatDate(property.soldDate)} />
        </Stack>
        <Box
          mt={2}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          <Chip
            label={`${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`}
            color={percentageColor}
            sx={{ fontWeight: 600 }}
          />
          {property.url && (
            <Button
              component="a"
              href={property.url}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              variant="text"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "secondary.main",
                "&:hover": {
                  color: "secondary.dark",
                  textDecoration: "underline",
                },
              }}
            >
              Visa annons →
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function TableView({ included, excluded }) {
  const rows = useMemo(() => [...included, ...excluded], [included, excluded]);
  const includedIds = useMemo(
    () => new Set(included.map((item) => item.id)),
    [included]
  );

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="medium">
        <TableHead>
          <TableRow>
            <TableCell align="right">Skillnad</TableCell>
            <TableCell>Adress</TableCell>
            <TableCell>Område</TableCell>
            <TableCell align="right">Utgångspris</TableCell>
            <TableCell align="right">Slutpris</TableCell>
            <TableCell align="right">Såld</TableCell>
            <TableCell>Källa</TableCell>
            <TableCell>Länk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((property) => {
            const includedRow = includedIds.has(property.id);
            const percentage = Number(property.percentChange) || 0;

            return (
              <TableRow
                key={property.id}
                sx={{
                  opacity: includedRow ? 1 : 0.55,
                }}
              >
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    color: percentage >= 0 ? "success.main" : "error.main",
                  }}
                >
                  {percentage >= 0 ? "+" : ""}
                  {percentage.toFixed(1)}%
                </TableCell>
                <TableCell>{property.address}</TableCell>
                <TableCell>{property.area}</TableCell>
                <TableCell align="right">
                  {formatPrice(property.askingPrice)} kr
                </TableCell>
                <TableCell align="right">
                  {formatPrice(property.finalPrice)} kr
                </TableCell>
                <TableCell align="right">
                  {formatDate(property.soldDate)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={property.source}
                    size="small"
                    sx={{
                      textTransform: "capitalize",
                      fontWeight: 600,
                      bgcolor:
                        property.source === "hemnet"
                          ? "rgba(22, 163, 74, 0.16)"
                          : "rgba(17, 24, 39, 0.12)",
                      color:
                        property.source === "hemnet"
                          ? "rgba(22, 101, 52, 0.95)"
                          : "#111827",
                      border: "1px solid",
                      borderColor:
                        property.source === "hemnet"
                          ? "rgba(22, 163, 74, 0.4)"
                          : "rgba(17, 24, 39, 0.35)",
                    }}
                  />
                </TableCell>
                <TableCell>
                  {property.url ? (
                    <Button
                      component="a"
                      href={property.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        color: "secondary.main",
                        "&:hover": {
                          color: "secondary.dark",
                          textDecoration: "underline",
                        },
                      }}
                    >
                      Visa annons →
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      -
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function StatCard({ title, value, subtitle, emphasis = false }) {
  return (
    <Card
      variant="outlined"
      sx={{
        backgroundColor: emphasis ? "#111827" : "background.paper",
        color: emphasis ? "#f9fafb" : "text.primary",
        height: "100%",
      }}
    >
      <CardContent>
        <Typography
          variant="overline"
          color={emphasis ? "rgba(249, 250, 251, 0.72)" : "text.secondary"}
          letterSpacing={1}
        >
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={600} mt={1}>
          {value}
        </Typography>
        {subtitle && (
          <Typography
            variant="body2"
            color={emphasis ? "rgba(249, 250, 251, 0.75)" : "text.secondary"}
          >
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, subdued = false }) {
  return (
    <Box mb={1.5} display="flex" alignItems="center" gap={1}>
      <Typography
        variant="subtitle2"
        color={subdued ? "text.disabled" : "text.secondary"}
        sx={{ textTransform: "uppercase", letterSpacing: 1 }}
      >
        {title}
      </Typography>
      <Box flexGrow={1}>
        <Divider />
      </Box>
    </Box>
  );
}

function PropertyInfo({ label, value }) {
  return (
    <Box display="flex" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  );
}

function EmptyState({ message }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        py: 5,
        px: 3,
        textAlign: "center",
        bgcolor: "background.default",
        borderStyle: "dashed",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Paper>
  );
}

function normalizeProperty(property, source) {
  const area =
    extractArea(property) ||
    property.descriptiveAreaName ||
    property.area ||
    "";

  const askingPrice = getAskingPrice(property);
  const finalPrice = getFinalPrice(property);
  const percentChange = getPercentChange(property, askingPrice, finalPrice);

  return {
    ...property,
    source,
    askingPrice,
    finalPrice,
    percentChange,
    address: property.streetAddress || property.address || "Ingen adress",
    area,
    soldDate: property.soldDate || "",
    id: property.id || property.booliId || `${source}-${Math.random()}`,
    url: generatePropertyUrl(property, source),
  };
}

function extractArea(property) {
  if (typeof property.location === "string") {
    return property.location;
  }

  if (property.location && typeof property.location === "object") {
    return (
      property.location.region?.municipalityName || property.location.area || ""
    );
  }

  return "";
}

function getAskingPrice(property) {
  const candidates = [
    property.askingPrice,
    property.listPrice,
    property.askPrice,
    property.price,
  ];

  for (const candidate of candidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return 0;
}

function getFinalPrice(property) {
  const candidates = [
    property.finalPrice,
    property.soldPrice,
    property.salePrice,
  ];

  for (const candidate of candidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return 0;
}

function parsePriceValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) {
      return null;
    }
    return parseInt(digits, 10);
  }

  if (typeof value === "object") {
    if ("raw" in value && value.raw !== undefined) {
      return parsePriceValue(value.raw);
    }
    if ("value" in value && value.value !== undefined) {
      return parsePriceValue(value.value);
    }
    if ("formatted" in value && value.formatted !== undefined) {
      return parsePriceValue(value.formatted);
    }
  }

  return null;
}

function parsePercentageValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace("%", "").replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "object") {
    if ("raw" in value && value.raw !== undefined) {
      return parsePercentageValue(value.raw);
    }
    if ("value" in value && value.value !== undefined) {
      return parsePercentageValue(value.value);
    }
    if ("formatted" in value && value.formatted !== undefined) {
      return parsePercentageValue(value.formatted);
    }
  }

  return null;
}

function getPercentChange(property, askingPrice, finalPrice) {
  const candidates = [
    property.percentChange,
    property.soldPricePercentageDiff,
    property.percentageChange,
  ];

  for (const candidate of candidates) {
    const parsed = parsePercentageValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (askingPrice > 0 && finalPrice > 0) {
    return ((finalPrice - askingPrice) / askingPrice) * 100;
  }

  return 0;
}

function generatePropertyUrl(property, source) {
  if (property.url) {
    if (property.url.startsWith("http")) {
      return property.url;
    }
    if (property.url.startsWith("/")) {
      return source === "booli"
        ? `https://www.booli.se${property.url}`
        : `https://www.hemnet.se${property.url}`;
    }
  }

  if (source === "booli" && (property.id || property.booliId)) {
    const id = property.id || property.booliId;
    return `https://www.booli.se/annons/${id}`;
  }

  if (source === "hemnet" && property.id) {
    return `https://www.hemnet.se/salda/${property.id}`;
  }

  return null;
}

function getPriceBounds(properties) {
  if (!properties.length) {
    return { min: 0, max: PRICE_STEP };
  }

  const prices = properties
    .map((property) => property.askingPrice)
    .filter(
      (price) => typeof price === "number" && !Number.isNaN(price) && price >= 0
    );

  if (!prices.length) {
    return { min: 0, max: PRICE_STEP };
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return {
    min: Math.max(
      0,
      snapToStep(Math.floor(minPrice / PRICE_STEP) * PRICE_STEP, PRICE_STEP)
    ),
    max: Math.ceil(maxPrice / PRICE_STEP) * PRICE_STEP,
  };
}

function getDefaultMinPrice(minBound, maxBound) {
  if (maxBound <= minBound) {
    return minBound;
  }

  const snappedDefault = snapToStep(
    Math.max(minBound, DEFAULT_MIN_PRICE),
    PRICE_STEP
  );
  return clamp(snappedDefault, minBound, maxBound);
}

function normalizeSoldRange(option) {
  if (option === "all") {
    return "all";
  }
  if (SOLD_DATE_OPTIONS.some((item) => item.value === option)) {
    return option;
  }
  return DEFAULT_SOLD_RANGE;
}

function computeLookbackDate(option) {
  const normalized = normalizeSoldRange(option);
  if (normalized === "all") {
    return null;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  let monthsDifference = 0;

  if (normalized.endsWith("m")) {
    monthsDifference = parseInt(normalized, 10);
  } else if (normalized.endsWith("y")) {
    monthsDifference = parseInt(normalized, 10) * 12;
  }

  if (Number.isNaN(monthsDifference)) {
    return null;
  }

  const totalMonths = year * 12 + month - monthsDifference;
  let targetYear = Math.floor(totalMonths / 12);
  let targetMonth = totalMonths % 12;

  if (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const firstOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1));
  const maxDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const targetDay = Math.min(day, maxDay);
  firstOfMonth.setUTCDate(targetDay);

  return firstOfMonth;
}

function getLookbackTimestamp(option) {
  const date = computeLookbackDate(option);
  return date ? date.getTime() : null;
}

function getSoldTimestamp(property) {
  if (!property || !property.soldDate) {
    return null;
  }
  const parsed = Date.parse(property.soldDate);
  return Number.isNaN(parsed) ? null : parsed;
}

function sortProperties(properties, field) {
  const fieldGetter = (property) => {
    switch (field) {
      case "askingPrice":
        return typeof property.askingPrice === "number"
          ? property.askingPrice
          : null;
      case "finalPrice":
        return typeof property.finalPrice === "number"
          ? property.finalPrice
          : null;
      case "percentChange":
        return typeof property.percentChange === "number"
          ? property.percentChange
          : null;
      case "soldDate":
      default:
        return getSoldTimestamp(property);
    }
  };

  return [...properties].sort((a, b) => {
    const valueA = fieldGetter(a);
    const valueB = fieldGetter(b);

    if (valueA === valueB) {
      return 0;
    }
    if (valueA === null || valueA === undefined) {
      return 1;
    }
    if (valueB === null || valueB === undefined) {
      return -1;
    }

    return valueB - valueA;
  });
}

function calculateStats(properties) {
  if (!properties.length) {
    return { average: 0, median: 0 };
  }

  const percentages = properties
    .map((property) => property.percentChange)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));

  if (!percentages.length) {
    return { average: 0, median: 0 };
  }

  const average =
    percentages.reduce((total, value) => total + value, 0) / percentages.length;

  const sorted = [...percentages].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return { average, median };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function snapToStep(value, step) {
  return Math.round(value / step) * step;
}

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "N/A";
  }
  return numeric.toLocaleString("sv-SE");
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE");
}

export default App;
