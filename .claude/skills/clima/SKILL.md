---
name: clima
description: Consulta la temperatura y el estado del clima actual de una ciudad (por defecto Chihuahua, Chihuahua, México). Úsala cuando el usuario pida el clima, la temperatura o el estado del tiempo.
argument-hint: "[ciudad]"
---

# Clima

Reporta el clima actual de la ciudad indicada en `$ARGUMENTS`. Si no se indica ninguna, usa **Chihuahua, Chihuahua, México**.

## Pasos

1. Reemplaza los espacios de la ciudad por `+` y consulta wttr.in con Bash (los datos llegan sin caché, a diferencia de WebFetch, que guarda 15 minutos por URL):

   ```bash
   curl -s "https://wttr.in/Chihuahua,Chihuahua?format=%l:+%t+(sensación+%f),+%C,+humedad+%h,+viento+%w,+hora+%T"
   ```

2. Si `curl` falla o devuelve vacío, usa WebFetch con `https://wttr.in/<ciudad>?format=j1` y extrae temperatura, sensación térmica, condición, humedad y viento.

3. Responde en español, en una o dos líneas: temperatura en °C, sensación térmica, estado del clima, humedad y viento.

## Notas

- wttr.in puede resolver la ciudad a una zona cercana (p. ej. otra localidad de Chihuahua); menciónalo si el nombre devuelto no coincide con el pedido.
- La fuente actualiza aproximadamente cada 30-60 minutos, así que consultas repetidas pueden dar el mismo valor.
- No uses esta skill en un loop por minuto esperando datos distintos cada vez.
